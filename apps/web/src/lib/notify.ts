import { toast } from "sonner";
import { friendlyError } from "@/lib/api/errors";

export function toastError(err: unknown, fallback?: string) {
  const msg = friendlyError(err);
  toast.error(fallback && !msg ? fallback : msg);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Client-side CSV of already-loaded rows (UTF-8 BOM so Excel opens Nepali text). */
export function downloadCsv(rows: Array<Record<string, unknown>>, columns: string[], filename: string) {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map(cell).join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\r\n");
  downloadBlob(new Blob([`﻿${csv}\r\n`], { type: "text/csv;charset=utf-8" }), filename);
}
