/**
 * Dual-write helper: after a local POS sale, mirror the order to Nest API via BFF.
 * Failures are logged only — local Zustand sale still succeeds (Phase 1).
 */
export async function mirrorStoreOrderToApi(input: {
  customerName?: string;
  customerPhone?: string;
  paymentStatus?: "paid" | "unpaid" | "partial";
  items: { sku: string; qty: number }[];
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_GLAMO_API_MIRROR === "0") return;
  if (!input.items.length) return;

  try {
    const res = await fetch("/api/commerce/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        paymentStatus: input.paymentStatus ?? "paid",
        items: input.items,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.warn("[glamo-api] mirror failed", res.status, detail);
    }
  } catch (e) {
    console.warn("[glamo-api] mirror error", e);
  }
}
