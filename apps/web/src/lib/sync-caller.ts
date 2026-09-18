/**
 * Keep POS / Phone callers in both commerce localStorage and the Customers (Zustand) list.
 */

import { useAppStore } from "@/lib/store";

export function syncCallerToAppStore(input: {
  name: string;
  phone: string;
  area?: string;
}): void {
  if (typeof window === "undefined") return;
  const phone = input.phone.trim();
  const name = input.name.trim();
  if (!name || !phone) return;

  const store = useAppStore.getState();
  const tenantId = store.activeTenantId;
  if (!tenantId) return;

  const existing = store.customers.find(
    (c) => c.tenantId === tenantId && c.phone === phone,
  );
  const area = input.area?.trim() || "Walk-in / Phone";

  if (existing) {
    store.updateCustomer(existing.id, { name, phone, area });
    return;
  }

  store.addCustomer({
    name,
    type: "INDIVIDUAL",
    phone,
    area,
    creditLimit: 0,
  });
}
