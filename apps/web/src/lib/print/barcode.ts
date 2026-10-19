/** Barcode helpers (jsbarcode → inline SVG markup) for bills, delivery notes and shelf labels. */

import JsBarcode from "jsbarcode";
import { escapeHtml } from "./print-document";

export type BarcodeFormat = "EAN13" | "CODE128";

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** EAN-13 when the code is a valid 13-digit EAN (in-store or manufacturer), otherwise CODE128. */
export function barcodeFormatFor(code: string): BarcodeFormat {
  return isValidEan13(code.trim()) ? "EAN13" : "CODE128";
}

/**
 * SVG markup for a label barcode, sized in CSS by the caller (viewBox keeps it
 * crisp at any size). Bars only — the caller prints the digits as text, which
 * renders identically in every browser and print driver.
 */
export function labelBarcodeSvg(code: string, opts: { height?: number } = {}): string {
  const value = code.trim();
  const format = barcodeFormatFor(value);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, { format, width: 2, height: opts.height ?? 60, displayValue: false, margin: 0 });
  } catch {
    return `<span class="bc-fallback">${escapeHtml(value)}</span>`;
  }
  const w = svg.getAttribute("width");
  const h = svg.getAttribute("height");
  if (w && h) {
    svg.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
    svg.setAttribute("preserveAspectRatio", "none");
  }
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("class", "bc");
  svg.setAttribute("data-format", format);
  return svg.outerHTML;
}

/** CODE128 SVG markup used on bills and delivery notes (bill number / order reference). */
export function barcodeSvgForPrint(code: string, opts?: { width?: number; height?: number; barWidth?: number }) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const width = opts?.width ?? 220;
  const height = opts?.height ?? 56;
  try {
    JsBarcode(svg, code, {
      format: "CODE128",
      width: opts?.barWidth ?? 1.6,
      height: height - 8,
      displayValue: false,
      margin: 0,
    });
  } catch {
    return `<span style="font-family:monospace;font-size:12px">${escapeHtml(code)}</span>`;
  }
  svg.setAttribute("class", "bc");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  return svg.outerHTML;
}
