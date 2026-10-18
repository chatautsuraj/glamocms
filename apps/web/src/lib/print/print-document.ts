/**
 * Print an HTML document through a hidden same-origin iframe: no pop-up
 * blocker, no app chrome, works after an await (auto-print after a sale) and
 * offline. Waits for images (logo, QR) before opening the print dialog and
 * prints exactly once.
 */

const IMAGE_TIMEOUT_MS = 2500;
const REMOVE_AFTER_MS = 5 * 60_000;

function waitForImages(doc: Document): Promise<void> {
  const pending = Array.from(doc.images).filter((img) => !img.complete);
  if (!pending.length) return Promise.resolve();
  const loads = pending.map((img) => new Promise<void>((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  }));
  return Promise.race([Promise.all(loads).then(() => undefined), new Promise<void>((r) => setTimeout(r, IMAGE_TIMEOUT_MS))]);
}

export function printDocument(html: string): boolean {
  if (typeof document === "undefined") return false;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.title = "Print";
  iframe.style.cssText = "position:absolute;left:-10000px;top:0;width:1px;height:1px;border:0;";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };
  // Printing focuses the frame; give focus back so the keyboard keeps working (Enter = New sale).
  const before = document.activeElement as HTMLElement | null;
  const restoreFocus = () => {
    if (document.activeElement !== iframe && document.activeElement !== document.body) return;
    const target = before?.isConnected ? before : document.querySelector<HTMLElement>("[role=dialog] [data-autofocus]");
    target?.focus();
  };
  void waitForImages(doc).then(() => {
    win.addEventListener("afterprint", () => {
      restoreFocus();
      setTimeout(remove, 500);
    }, { once: true });
    try {
      win.focus();
      win.print();
    } catch {
      remove();
      return;
    }
    restoreFocus();
    setTimeout(remove, REMOVE_AFTER_MS);
  });
  return true;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
