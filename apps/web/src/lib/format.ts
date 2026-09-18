export function formatNPR(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 100000) {
    return `Rs ${(amount / 100000).toFixed(1)}L`;
  }
  if (compact && Math.abs(amount) >= 1000) {
    return `Rs ${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace("NPR", "Rs");
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-NP").format(n);
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-NP", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-NP", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export const VAT_RATE = 0.13;

export function calcVat(subtotal: number) {
  const vat = Math.round(subtotal * VAT_RATE);
  return { subtotal, vat, total: subtotal + vat };
}

/** Effective VAT rate for a tenant (0 when VAT service is off). */
export function tenantVatRate(vatEnabled = true) {
  return vatEnabled ? VAT_RATE : 0;
}

/** Apply 13% VAT only when the tenant has VAT enabled. */
export function calcVatIfEnabled(subtotal: number, vatEnabled = true) {
  if (!vatEnabled) return { subtotal, vat: 0, total: subtotal };
  return calcVat(subtotal);
}
