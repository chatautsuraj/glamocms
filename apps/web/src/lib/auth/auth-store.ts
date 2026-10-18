/** Zustand auth store: Firebase user → POST /pos/session → {user, permissions, store}. */
import { create } from "zustand";
import type { Permission, PosSession, SessionUser, StoreProfile } from "@/lib/api/types";

export type AuthStatus = "loading" | "signedOut" | "ready" | "denied";

export interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  permissions: Permission[];
  store: StoreProfile | null;
  /** Session restored from the IndexedDB cache because the API was unreachable. */
  offlineSession: boolean;
  error: string | null;
  setSession: (s: PosSession, offline?: boolean) => void;
  setStore: (store: StoreProfile) => void;
  setSignedOut: (error?: string | null) => void;
  setDenied: (error: string) => void;
  can: (p: Permission) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  permissions: [],
  store: null,
  offlineSession: false,
  error: null,
  setSession: (s, offline = false) =>
    set({ status: "ready", user: s.user, permissions: s.permissions, store: s.store, offlineSession: offline, error: null }),
  setStore: (store) => set({ store }),
  setSignedOut: (error = null) => set({ status: "signedOut", user: null, permissions: [], store: null, offlineSession: false, error }),
  setDenied: (error) => set({ status: "denied", user: null, permissions: [], store: null, offlineSession: false, error }),
  can: (p) => get().permissions.includes(p),
}));

export const useCan = (p: Permission) => useAuthStore((s) => s.permissions.includes(p));
