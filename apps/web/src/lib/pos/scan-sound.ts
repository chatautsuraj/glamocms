/**
 * Short confirmation tones for scans (Web Audio — no audio files, works
 * offline). "ok" = bright high beep, "error" = low double buzz. Respects the
 * cashier's sound toggle (stored on this device).
 */
const PREF_KEY = "glamo-pos:scan-sound";

let ctx: AudioContext | null = null;

export function scanSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREF_KEY) !== "off";
}

export function setScanSoundEnabled(on: boolean) {
  window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
}

function tone(context: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, volume: number) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playScanSound(kind: "ok" | "error") {
  if (!scanSoundEnabled()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    if (kind === "ok") tone(ctx, 1760, t, 0.09, "sine", 0.18);
    else {
      tone(ctx, 220, t, 0.14, "square", 0.08);
      tone(ctx, 196, t + 0.18, 0.18, "square", 0.08);
    }
  } catch {
    /* audio is a nicety; never block a sale */
  }
}
