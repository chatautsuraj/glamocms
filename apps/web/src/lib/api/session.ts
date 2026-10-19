/** POS session + selling config — see POS-API-CONTRACT.md. */
import { api } from "./client";
import type { PosConfig, PosSession } from "./types";

export type SignInMethod = "google" | "password";

export const sessionApi = {
  create: () => api.post<PosSession>("/pos/session", {}, { quiet: true }),
  config: () => api.get<PosConfig>("/pos/config", undefined, { quiet: true }),

  /**
   * Audit alerts. Both are best-effort: the caller ignores failures so they can
   * never block sign-in. `loginAlert` runs after a successful Firebase sign-in
   * (the token authenticates the email); `loginFailed` reports a rejected
   * client-side attempt (wrong password / unknown account) and is rate-limited
   * and CSRF-exempt on the server.
   */
  loginAlert: (method: SignInMethod) => api.post<{ alerted: boolean }>("/pos/auth/login-alert", { method }, { quiet: true }),
  loginFailed: (email: string, reason: string) => api.post<{ alerted: boolean }>("/pos/auth/login-failed", { email, reason }, { quiet: true }),
};
