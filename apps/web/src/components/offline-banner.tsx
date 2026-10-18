"use client";

import Link from "next/link";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth/auth-store";
import { runSyncCycle, useOfflineStore } from "@/lib/offline/sync-runner";
import { cn } from "@/lib/utils";

/** "No internet — N sales waiting" + sync problems that need a manager. */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOfflineStore((s) => s.online);
  const pending = useOfflineStore((s) => s.pending);
  const needsAttention = useOfflineStore((s) => s.needsAttention);
  const conflicts = useOfflineStore((s) => s.conflicts);
  const syncing = useOfflineStore((s) => s.syncing);
  const canReconcile = useAuthStore((s) => s.permissions.includes("inventory.write"));
  if (online && pending === 0 && needsAttention === 0 && conflicts === 0) return null;
  const sales = `${pending} ${pending === 1 ? "sale" : "sales"}`;
  return (
    <div role="status" aria-live="polite" className={cn("mb-4 space-y-2", className)}>
      {(!online || pending > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm">
          <CloudOff className="h-4 w-4 text-warning" aria-hidden />
          <span className="font-medium">
            {online
              ? `Sending ${sales} saved while offline…`
              : pending > 0
                ? `No internet. You can keep selling — ${sales} saved on this device will be sent automatically.`
                : "No internet. You can keep selling; sales will be sent when the internet is back."}
          </span>
          {online && (
            <Button size="sm" variant="outline" onClick={() => void runSyncCycle()} disabled={syncing}>
              <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden /> Send now
            </Button>
          )}
        </div>
      )}
      {(needsAttention > 0 || conflicts > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          <span>
            {conflicts > 0 && `${conflicts} offline ${conflicts === 1 ? "sale sold" : "sales sold"} more than the stock we had. `}
            {needsAttention > 0 && `${needsAttention} offline ${needsAttention === 1 ? "sale was" : "sales were"} not accepted by the server.`}
          </span>
          {canReconcile ? (
            <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/inventory?tab=reconcile">Check now</Link>
          ) : (
            <span className="text-muted-foreground">Ask a manager to check.</span>
          )}
        </div>
      )}
    </div>
  );
}
