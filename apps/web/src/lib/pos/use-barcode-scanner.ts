"use client";

import { useEffect, useMemo, useRef } from "react";
import { ScanBurstDetector, isTypingTarget, stripScannedSuffix } from "./scanner";

const MAX_GAP_MS = 60;

/** Set an input's value the way React notices (native setter + input event). */
function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Listens for USB barcode scanner bursts anywhere on the page (capture phase),
 * including while a text box has focus. When a burst completes, the typed
 * characters are taken back out of that text box and `onScan(code)` runs.
 * Returns `isScanning()` so single-key shortcuts can hold back mid-scan.
 */
export function useBarcodeScanner({ enabled, onScan }: { enabled: boolean; onScan: (code: string) => void }) {
  const onScanRef = useRef(onScan);
  const detectorRef = useRef(new ScanBurstDetector({ maxGapMs: MAX_GAP_MS }));
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    const detector = detectorRef.current;
    detector.reset();
    let lastCharAt = -Infinity;
    let burstTarget: HTMLInputElement | HTMLTextAreaElement | null = null;
    let valueBefore = "";

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const at = e.timeStamp || performance.now();
      if (e.key.length === 1) {
        // First key of a new burst: remember the focused field's value before the scanner typed into it.
        if (at - lastCharAt > MAX_GAP_MS) {
          const t = e.target;
          burstTarget = isTypingTarget(t) && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) ? t : null;
          valueBefore = burstTarget?.value ?? "";
        }
        lastCharAt = at;
      }
      const result = detector.push(e.key, at);
      if (result.kind !== "scan" || !result.code) return;
      e.preventDefault();
      e.stopPropagation();
      if (burstTarget && document.contains(burstTarget)) {
        const cleaned = burstTarget.value.endsWith(result.code) ? stripScannedSuffix(burstTarget.value, result.code) : valueBefore;
        if (cleaned !== burstTarget.value) setInputValue(burstTarget, cleaned);
      }
      burstTarget = null;
      lastCharAt = -Infinity;
      onScanRef.current(result.code);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);

  return useMemo(() => ({ isScanning: () => detectorRef.current.isBursting(performance.now()) }), []);
}
