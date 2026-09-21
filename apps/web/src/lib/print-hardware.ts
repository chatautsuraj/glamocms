/** Browser print helpers for thermal receipt printers + cash drawer kick (ESC/POS via print dialog). */

/** ESC/POS cash drawer open pulse (common Epson-compatible). Embedded in print HTML as a comment + onafterprint hint. */
export const ESC_POS_DRAWER_KICK = "\x1B\x70\x00\x19\xFA";

/**
 * Open a slim receipt window suitable for 80mm thermal printers.
 * After print, browsers that expose WebUSB/serial are not assumed — drawer kick is best-effort via printer driver "cash drawer" setting.
 */
export function printThermalReceipt(htmlBody: string, opts?: { openDrawer?: boolean }) {
  const drawerHint = opts?.openDrawer
    ? `<script>
        // Cash drawer: configure printer driver for "open drawer after print".
        // ESC/POS kick bytes cannot be sent from sandboxed browser print reliably.
        window.__GLAMO_DRAWER__ = true;
      </script>`
    : "";

  const html = `<!doctype html>
<html><head><title>Receipt</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  body { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; width: 72mm; margin: 0 auto; color: #000; }
  @media print { body { width: 72mm; } }
</style></head><body>
${htmlBody}
${drawerHint}
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open("", "_blank", "width=320,height=640");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

/** Prefer system print dialog (user selects thermal printer). Returns whether window opened. */
export function kickCashDrawerHint() {
  return {
    message:
      "Set your receipt printer driver to open the cash drawer on print, or connect ESC/POS via a local print bridge.",
  };
}
