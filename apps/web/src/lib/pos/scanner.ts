/**
 * USB HID barcode scanners act as keyboards ("keyboard wedge"): they type the
 * code very fast and finish with Enter. WedgeDetector tells those bursts apart
 * from a human typing, so the till can listen globally whenever focus is NOT
 * in a text field.
 */

export interface WedgeOptions {
  /** Max gap between scanner keystrokes (ms). Humans are ~100ms+. */
  maxGapMs?: number;
  /** Minimum code length to accept. */
  minLength?: number;
}

export class WedgeDetector {
  private buffer = "";
  private last = 0;
  private readonly maxGap: number;
  private readonly minLength: number;

  constructor(opts: WedgeOptions = {}) {
    this.maxGap = opts.maxGapMs ?? 50;
    this.minLength = opts.minLength ?? 3;
  }

  /** Feed one key; returns a scanned code when Enter closes a fast burst. */
  push(key: string, at: number): string | null {
    if (key === "Enter") {
      const code = this.buffer;
      const fresh = at - this.last <= this.maxGap * 4;
      this.reset();
      return code.length >= this.minLength && fresh ? code : null;
    }
    if (key.length !== 1) return null; // Shift, Tab, arrows…
    if (this.buffer && at - this.last > this.maxGap) this.buffer = "";
    this.buffer += key;
    this.last = at;
    return null;
  }

  reset() {
    this.buffer = "";
    this.last = 0;
  }
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
