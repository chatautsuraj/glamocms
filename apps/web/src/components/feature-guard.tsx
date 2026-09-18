"use client";

/**
 * Pass-through — Glamo single-store CMS does not gate modules by feature flag.
 * Kept so older imports do not break; dashboard layout no longer wraps with this.
 */
export function FeatureGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
