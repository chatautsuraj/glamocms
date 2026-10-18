"use client";

import { useCallback, useEffect, useState } from "react";
import { tillApi } from "@/lib/api/till";
import { ApiError } from "@/lib/api/errors";
import type { TillShift } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { getMeta, setMeta } from "@/lib/offline/db";

/** Current till shift for the signed-in cashier (cached for offline selling). */
export function useTillShift() {
  const userId = useAuthStore((s) => s.user?.id);
  const [shift, setShift] = useState<TillShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const key = `shift:${userId}`;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const current = await tillApi.current();
      setShift(current);
      setFromCache(false);
      await setMeta(key, current);
    } catch (err) {
      if (err instanceof ApiError && err.isNetwork) {
        setShift((await getMeta<TillShift | null>(key)) ?? null);
        setFromCache(true);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, key]);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = useCallback(async (next: TillShift | null) => {
    setShift(next && next.status === "open" ? next : null);
    await setMeta(key, next && next.status === "open" ? next : null);
  }, [key]);

  return { shift, loading, fromCache, refresh, update };
}
