"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/lib/auth/auth-store";
import { canAccessPath, homeFor } from "@/lib/auth/permissions";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const permissions = useAuthStore((s) => s.permissions);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "signedOut" || status === "denied") router.replace("/login");
  }, [status, router]);

  if (status !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-4 p-8" role="status" aria-label="Loading">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      {canAccessPath(permissions, pathname) ? (
        children
      ) : (
        <EmptyState
          icon={ShieldAlert}
          title="No access"
          description="Your role doesn't include this page. Ask a manager if you need it."
          action={{ label: "Go to my home page", href: homeFor(permissions) }}
        />
      )}
    </AppShell>
  );
}
