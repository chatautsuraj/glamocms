/**
 * USB barcode scanners act as keyboards ("keyboard wedge"): they type the code
 * as a very fast burst of keystrokes and finish with Enter. ScanBurstDetector
 * tells such bursts apart from a person typing, wherever focus is — including
 * inside the POS search box — so a label scan always adds the product.
 *
 * Rules (all must hold for a scan):
 *  - at least `minLength` printable characters since the burst started,
 *  - every gap between consecutive characters ≤ `maxGapMs`,
 *  - average gap ≤ `maxAvgGapMs`,
 *  - Enter arrives ≤ `maxGapMs` after the last character.
 * A slow keystroke starts a new burst, so "typed slowly, then scanned" still
 * yields just the scanned code. Pure (time is passed in) → unit tested.
 */

export interface ScanBurstOptions {
  /** Longest pause between two scanner keystrokes (ms). People rarely sustain < 60ms. */
  maxGapMs?: number;
  /** Average pause across the burst (ms). Scanners are ~1–30ms. */
  maxAvgGapMs?: number;
  /** Shortest code accepted. */
  minLength?: number;
}

export type ScanEvent = { kind: "none" } | { kind: "char" } | { kind: "scan"; code: string };

export class ScanBurstDetector {
  private chars: string[] = [];
  private times: number[] = [];
  private readonly maxGap: number;
  private readonly maxAvgGap: number;
  private readonly minLength: number;

  constructor(opts: ScanBurstOptions = {}) {
    this.maxGap = opts.maxGapMs ?? 60;
    this.maxAvgGap = opts.maxAvgGapMs ?? 35;
    this.minLength = opts.minLength ?? 4;
  }

  /** Feed one KeyboardEvent.key with its timestamp (performance.now()). */
  push(key: string, at: number): ScanEvent {
    if (key === "Enter") {
      const result = this.evaluate(at);
      this.reset();
      return result;
    }
    if (key.length !== 1) return { kind: "none" }; // Shift, arrows, F-keys… don't break a burst
    const last = this.times[this.times.length - 1];
    if (last !== undefined && at - last > this.maxGap) this.reset();
    this.chars.push(key);
    this.times.push(at);
    return { kind: "char" };
  }

  /** True while a fast burst is in progress (used to hold back single-key shortcuts). */
  isBursting(at: number): boolean {
    const last = this.times[this.times.length - 1];
    return this.chars.length >= 2 && last !== undefined && at - last <= this.maxGap;
  }

  reset() {
    this.chars = [];
    this.times = [];
  }

  private evaluate(at: number): ScanEvent {
    const n = this.chars.length;
    if (n < this.minLength) return { kind: "none" };
    const last = this.times[n - 1];
    if (at - last > this.maxGap) return { kind: "none" };
    let total = 0;
    for (let i = 1; i < n; i++) {
      const gap = this.times[i] - this.times[i - 1];
      if (gap > this.maxGap) return { kind: "none" };
      total += gap;
    }
    if (total / (n - 1) > this.maxAvgGap) return { kind: "none" };
    return { kind: "scan", code: this.chars.join("").trim() };
  }
}

/**
 * The scanner also typed its code into whatever input had focus. Remove the
 * scanned characters from the end of that value (what the person had typed
 * before the scan is kept).
 */
export function stripScannedSuffix(value: string, code: string): string {
  if (code && value.endsWith(code)) return value.slice(0, value.length - code.length);
  return value;
}

/** True when the keyboard event target is a place the user types text. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select" || el.isContentEditable) return true;
  if (tag !== "input") return false;
  const type = ((el as HTMLInputElement).type || "text").toLowerCase();
  return !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file"].includes(type);
}
