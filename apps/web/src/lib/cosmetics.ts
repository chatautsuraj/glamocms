/** Date-only shelf-life checks use the store's local calendar, not UTC midnight. */
export function expiryState(expiresOn?: string, now = new Date()): "none" | "expired" | "soon" | "ok" {
  if (!expiresOn) return "none";
  const expiry = new Date(`${expiresOn}T00:00:00`);
  if (!Number.isFinite(expiry.getTime())) return "none";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 90);
  if (expiry < today) return "expired";
  return expiry <= limit ? "soon" : "ok";
}

export function saleBlockReason(product: { name: string; expiresOn?: string; isTester?: boolean }, now = new Date()): string | null {
  if (product.isTester) return `${product.name} is a tester and cannot be sold`;
  if (expiryState(product.expiresOn, now) === "expired") return `${product.name} has expired and cannot be sold`;
  return null;
}
