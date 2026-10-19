"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { signInWithEmailPassword, signInWithGoogle } from "@/lib/auth/firebase";
import { sessionApi } from "@/lib/api/session";
import { useAuthStore } from "@/lib/auth/auth-store";
import { homeFor } from "@/lib/auth/permissions";

function googleMessage(code: string): string {
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in popup — allow popups for this site.";
  if (code === "auth/network-request-failed") return "No internet connection — sign-in needs to be online the first time.";
  return "Google sign-in failed. Try again.";
}

function passwordMessage(code: string): string {
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/user-disabled") return "This account has been disabled.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a moment and try again.";
  if (code === "auth/network-request-failed") return "No internet connection — sign-in needs to be online the first time.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Incorrect email or password.";
  }
  return "Sign-in failed. Try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const { status, permissions, error } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready") router.replace(homeFor(permissions));
  }, [status, permissions, router]);

  const signIn = async () => {
    setBusy(true);
    setAuthError(null);
    useAuthStore.setState({ error: null, status: "loading" });
    try {
      await signInWithGoogle();
      // Best-effort audit alert; never blocks sign-in.
      await sessionApi.loginAlert("google").catch(() => undefined);
      // AuthProvider picks up the token, creates the POS session and redirects.
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      setAuthError(googleMessage(code));
      useAuthStore.getState().setSignedOut();
    } finally {
      setBusy(false);
    }
  };

  const signInWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim();
    setBusy(true);
    setAuthError(null);
    useAuthStore.setState({ error: null, status: "loading" });
    try {
      await signInWithEmailPassword(address, password);
      await sessionApi.loginAlert("password").catch(() => undefined);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "auth/unknown";
      setAuthError(passwordMessage(code));
      await sessionApi.loginFailed(address, code).catch(() => undefined);
      useAuthStore.getState().setSignedOut();
    } finally {
      setBusy(false);
    }
  };

  const message = authError ?? error;
  const disabled = busy || status === "loading";

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-5 text-center sm:p-8">
          <Image src="/images/logo.png" alt="GLAMO Nepal" width={160} height={96} priority className="mx-auto h-auto w-40" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">GLAMO POS</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to the GLAMO Nepal counter and back office.</p>
          </div>
          {message && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {message}
            </p>
          )}
          <Button size="lg" variant="brand" className="w-full" onClick={signIn} disabled={disabled} aria-busy={busy}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.65 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.28 12 6.28c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.69 3.74 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z" />
            </svg>
            {busy || status === "loading" ? "Signing in…" : "Sign in with Google"}
          </Button>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <form className="space-y-4 text-left" onSubmit={signInWithPassword}>
            <Field label="Email">
              <Input
                type="email"
                name="email"
                spellCheck={false}
                autoComplete="email"
                inputMode="email"
                placeholder="you@glamonepal.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={disabled}
              />
            </Field>
            <div className="space-y-1.5">
              <label htmlFor="staff-password" className="text-sm font-medium">Password</label>
              <span className="relative block">
                <Input
                  id="staff-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={disabled}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                </button>
              </span>
            </div>
            <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={disabled} aria-busy={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">Only staff added in Settings → Staff can sign in.</p>
        </CardContent>
      </Card>
    </main>
  );
}
