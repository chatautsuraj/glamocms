/**
 * Test harness for print output: registers a DOM (happy-dom), captures HTML
 * written to print popups and records every jsPDF drawing call, so bill /
 * delivery-note layouts can be compared byte-for-byte across refactors.
 */
process.env.TZ = "Asia/Kathmandu";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register({ url: "http://localhost/" });
import { jsPDF } from "jspdf";

export type PdfOp = [string, ...unknown[]];

let pdfOps: PdfOp[] = [];
const RECORDED = ["text", "line", "setFont", "setFontSize", "setDrawColor", "addPage", "addImage", "save"] as const;

type JsPdfWithEvents = typeof jsPDF & { API: { events: Array<[string, (this: Record<string, unknown>) => void]> } };
(jsPDF as JsPdfWithEvents).API.events.push([
  "initialized",
  function (this: Record<string, unknown>) {
    for (const name of RECORDED) {
      const original = this[name] as ((...args: unknown[]) => unknown) | undefined;
      if (typeof original !== "function") continue;
      this[name] = (...args: unknown[]) => {
        const recorded = args.map((a) => (typeof a === "string" && a.startsWith("data:") ? `${a.slice(0, 30)}…(${a.length})` : a));
        pdfOps.push([name, ...recorded]);
        if (name === "save") return this; // never touch the filesystem / browser download
        return original.apply(this, args);
      };
    }
  },
]);

let htmlWrites: string[] = [];
Object.defineProperty(window, "open", {
  configurable: true,
  value: () => ({
    document: { open() {}, write(html: string) { htmlWrites.push(html); }, close() {} },
    focus() {},
    print() {},
  }),
});

export function captureHtml(fn: () => unknown): string {
  htmlWrites = [];
  fn();
  return htmlWrites.join("");
}

export function capturePdf(fn: () => unknown): PdfOp[] {
  pdfOps = [];
  fn();
  return JSON.parse(JSON.stringify(pdfOps)) as PdfOp[];
}
