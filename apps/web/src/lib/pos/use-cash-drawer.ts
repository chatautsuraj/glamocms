"use client";

import { useCallback, useEffect, useState } from "react";
import { cashDrawerApi } from "@/lib/api/cash-drawer";
import { ApiError } from "@/lib/api/errors";
import type { DrawerShift } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { getMeta, setMeta } from "@/lib/offline/db";

/**
 * Today's optional cash-drawer count for the signed-in cashier (cached so an
 * offline sale can still be attached to it). Selling never waits for this.
 */
export function useCashDrawer() {
  const userId = useAuthStore((s) => s.user?.id);
  const [drawer, setDrawer] = useState<DrawerShift | null>(null);
  const [loading, setLoading] = useState(true);
  const key = `drawer:${userId}`;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const current = await cashDrawerApi.current();
      setDrawer(current);
      await setMeta(key, current);
    } catch (err) {
      if (err instanceof ApiError && err.isNetwork) setDrawer((await getMeta<DrawerShift | null>(key)) ?? null);
    } finally {
      setLoading(false);
    }
  }, [userId, key]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(
    async (next: DrawerShift | null) => {
      const open = next && next.status === "open" ? next : null;
      setDrawer(open);
      await setMeta(key, open);
    },
    [key],
  );

  return { drawer, loading, refresh, update };
}
