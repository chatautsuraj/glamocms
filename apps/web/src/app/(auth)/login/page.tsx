"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signInWithGoogle } from "@/lib/auth/firebase";
import { useAuthStore } from "@/lib/auth/auth-store";
import { homeFor } from "@/lib/auth/permissions";

export default function LoginPage() {
  const router = useRouter();
  const { status, permissions, error } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready") router.replace(homeFor(permissions));
  }, [status, permissions, router]);

  const signIn = async () => {
    setBusy(true);
    setPopupError(null);
    useAuthStore.setState({ error: null, status: "loading" });
    try {
      await signInWithGoogle();
      // AuthProvider picks up the token, creates the POS session and redirects.
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      setPopupError(
        code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
          ? "Sign-in was cancelled."
          : code === "auth/popup-blocked"
            ? "Your browser blocked the Google sign-in popup — allow popups for this site."
            : code === "auth/network-request-failed"
              ? "No internet connection — sign-in needs to be online the first time."
              : "Google sign-in failed. Try again.",
      );
      useAuthStore.getState().setSignedOut();
    } finally {
      setBusy(false);
    }
  };

  const message = popupError ?? error;

  return (
    <main id="main" className="atmospheric-bg flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-6 p-8 text-center">
          <Image src="/images/logo.png" alt="GLAMO Nepal" width={160} height={96} priority className="mx-auto h-auto w-40" />
          <div>
            <h1 className="font-display text-2xl font-semibold">GLAMO POS</h1>
            <p className="mt-1 text-sm text-muted-foreground">Staff sign-in with your GLAMO Google account.</p>
          </div>
          {message && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {message}
            </p>
          )}
          <Button size="lg" className="w-full" onClick={signIn} disabled={busy || status === "loading"} aria-busy={busy}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#fff" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.65 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.28 12 6.28c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.69 3.74 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z" />
            </svg>
            {busy || status === "loading" ? "Signing in…" : "Sign in with Google"}
          </Button>
          <p className="text-xs text-muted-foreground">Access is limited to GLAMO staff (cashier, manager, admin).</p>
        </CardContent>
      </Card>
    </main>
  );
}
