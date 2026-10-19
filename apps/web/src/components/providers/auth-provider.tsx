"use client";

/**
 * Wires Firebase Google auth to the POS session:
 * Firebase ID token → POST /pos/session → Zustand {user, permissions, store}.
 * Tokens refresh via onIdTokenChanged / getIdToken(); 401 → forced refresh →
 * sign-out to /login; 403 → toast. When the API is unreachable a cached
 * session (IndexedDB) keeps the POS usable offline. The session also carries
 * posConfig (VAT, payment methods, labels) which every screen reads.
 */
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { configureApi } from "@/lib/api/client";
import { ApiError, friendlyError } from "@/lib/api/errors";
import { sessionApi } from "@/lib/api/session";
import type { PosSession } from "@/lib/api/types";
import { currentIdToken, signOutFirebase, watchIdToken } from "@/lib/auth/firebase";
import { useAuthStore } from "@/lib/auth/auth-store";
import { getMeta, setMeta } from "@/lib/offline/db";
import { startOfflineRunner } from "@/lib/offline/sync-runner";
import { usePosConfig } from "@/lib/pos/config-store";

let lastForbiddenToast = 0;

export async function signOut(reason?: string) {
  try {
    await signOutFirebase();
  } finally {
    useAuthStore.getState().setSignedOut(reason ?? null);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    configureApi({
      getToken: (force) => currentIdToken(force),
      onUnauthorized: () => {
        if (useAuthStore.getState().status === "ready") {
          toast.error("Your session has ended. Please sign in again.");
          void signOut("Session expired");
        }
      },
      onForbidden: (err) => {
        if (Date.now() - lastForbiddenToast < 1500) return;
        lastForbiddenToast = Date.now();
        toast.error(friendlyError(err));
      },
    });

    let currentUid: string | null = null;
    let stopRunner: (() => void) | null = null;

    const unsubscribe = watchIdToken(async (fbUser) => {
      const store = useAuthStore.getState();
      if (!fbUser) {
        currentUid = null;
        stopRunner?.();
        stopRunner = null;
        if (store.status !== "denied") store.setSignedOut(store.error);
        return;
      }
      // onIdTokenChanged also fires on hourly refresh — only (re)create the session for a new user.
      if (currentUid === fbUser.uid && store.status === "ready") return;
      currentUid = fbUser.uid;
      try {
        const session = await sessionApi.create();
        store.setSession(session);
        if (session.posConfig) usePosConfig.getState().set(session.posConfig);
        await setMeta(`session:${fbUser.uid}`, session);
      } catch (err) {
        if (err instanceof ApiError && err.isNetwork) {
          const cached = await getMeta<PosSession>(`session:${fbUser.uid}`);
          if (cached) {
            store.setSession(cached, true);
            if (cached.posConfig) usePosConfig.getState().set(cached.posConfig);
            else await usePosConfig.getState().hydrate();
            toast.warning("You're offline. You can keep selling; sales will be sent when the internet is back.");
          } else {
            store.setSignedOut("Can't reach the GLAMO server to start your first session. Connect to the internet and try again.");
          }
        } else {
          const message = friendlyError(err);
          await signOutFirebase().catch(() => undefined);
          useAuthStore.getState().setDenied(message);
          return;
        }
      }
      const ready = useAuthStore.getState();
      if (!usePosConfig.getState().config) void usePosConfig.getState().refresh();
      if (!stopRunner && ready.permissions.includes("pos.sell")) stopRunner = startOfflineRunner();
    });

    return () => {
      unsubscribe();
      stopRunner?.();
    };
  }, []);

  return <>{children}</>;
}
