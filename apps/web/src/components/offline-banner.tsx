"use client";

import Link from "next/link";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth/auth-store";
import { runSyncCycle, useOfflineStore } from "@/lib/offline/sync-runner";

/** "Offline — N sales queued" + sync problems that need a manager. */
export function OfflineBanner() {
  const { online, pending, needsAttention, conflicts, syncing } = useOfflineStore();
  const canReconcile = useAuthStore((s) => s.permissions.includes("inventory.write"));
  if (online && pending === 0 && needsAttention === 0 && conflicts === 0) return null;
  return (
    <div role="status" aria-live="polite" className="mb-4 space-y-2">
      {(!online || pending > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm">
          <CloudOff className="h-4 w-4 text-warning" aria-hidden />
          <span className="font-medium">
            {online ? "Syncing" : "Offline"} — {pending} {pending === 1 ? "sale" : "sales"} queued
          </span>
          {online && (
            <Button size="sm" variant="outline" onClick={() => void runSyncCycle()} disabled={syncing}>
              <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden /> Sync now
            </Button>
          )}
        </div>
      )}
      {(needsAttention > 0 || conflicts > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          <span>
            {conflicts > 0 && `${conflicts} synced ${conflicts === 1 ? "sale has" : "sales have"} stock conflicts. `}
            {needsAttention > 0 && `${needsAttention} queued ${needsAttention === 1 ? "sale was" : "sales were"} rejected by the server.`}
          </span>
          {canReconcile ? (
            <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/inventory?tab=reconcile">Review</Link>
          ) : (
            <span className="text-muted-foreground">Ask a manager to review.</span>
          )}
        </div>
      )}
    </div>
  );
}
