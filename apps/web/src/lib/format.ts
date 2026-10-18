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
