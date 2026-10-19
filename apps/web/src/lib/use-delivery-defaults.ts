"use client";

import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api/settings";
import { useAuthStore } from "@/lib/auth/auth-store";

let cached: string | null = null;

/** Settings → Delivery → default NCM delivery type (managers can read settings). */
export function useDefaultDeliveryType(): string {
  const canRead = useAuthStore((s) => s.permissions.includes("settings.read"));
  const [type, setType] = useState(cached ?? "");
  useEffect(() => {
    if (!canRead || cached !== null) return;
    settingsApi.get().then((s) => {
      cached = s.delivery.defaultDeliveryType;
      setType(cached);
    }).catch(() => undefined);
  }, [canRead]);
  return type;
}
