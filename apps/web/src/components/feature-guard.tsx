"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { pathToFeature } from "@/lib/features";
import {
  useCanAccessAdmin,
  useEffectiveFeatures,
  useStoreUser,
} from "@/lib/use-entitlements";
import { cn } from "@/lib/utils";

/**
 * Enforce per-user module access from Settings.
 * Owners / company admins keep full store access.
 */
export function FeatureGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const effective = useEffectiveFeatures();
  const canAdmin = useCanAccessAdmin();
  const storeUser = useStoreUser();
  const feature = pathToFeature(pathname);

  const privileged =
    storeUser?.role === "OWNER" ||
    storeUser?.role === "ADMIN" ||
    storeUser?.role === "PLATFORM_ADMIN";

  const allowed =
    !feature ||
    feature === "dashboard" ||
    (feature === "admin"
      ? canAdmin
      : privileged || effective.includes(feature));

  useEffect(() => {
    if (feature === "admin" && !canAdmin) {
      router.replace("/dashboard");
    }
  }, [feature, canAdmin, router]);

  if (!allowed) {
    if (feature === "admin") return null;
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 rounded-2xl bg-muted p-4">
          <ShieldOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Feature not available</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          You do not have access to this module. Ask your store admin to enable it in
          Settings → Users.
        </p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
