const RAW_URL = process.env.GLAMO_API_URL?.trim() ?? "";
const API_KEY = process.env.GLAMO_API_KEY ?? "pos-local-dev";

/** On Vercel with no remote API URL, never dial localhost (causes multi-second hangs). */
function resolveApiUrl(): string | null {
  if (RAW_URL) {
    if (
      process.env.VERCEL === "1" &&
      (RAW_URL.includes("127.0.0.1") || RAW_URL.includes("localhost"))
    ) {
      return null;
    }
    return RAW_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL === "1") return null;
  return "http://127.0.0.1:3001/v1";
}

const UPSTREAM_MS = Number(process.env.GLAMO_API_TIMEOUT_MS ?? (process.env.GLAMO_API_URL ? 8000 : 600));
/** After a dead Nest, skip dialing it briefly so POS sales don't stack timeouts. */
const COOLDOWN_MS = Number(process.env.GLAMO_API_COOLDOWN_MS ?? 20_000);
let upstreamSkipUntil = 0;

export function getGlamoApiConfig() {
  return { API_URL: resolveApiUrl(), API_KEY };
}

export function isRemoteApiConfigured() {
  return Boolean(resolveApiUrl());
}

export async function glamoApi<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: unknown }> {
  const base = resolveApiUrl();
  if (!base) {
    return { ok: false, status: 503, error: "fetch failed" };
  }

  if (Date.now() < upstreamSkipUntil) {
    return { ok: false, status: 503, error: "fetch failed" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      if (res.status >= 500) {
        upstreamSkipUntil = Date.now() + COOLDOWN_MS;
      }
      return { ok: false, status: res.status, error: data ?? text };
    }
    upstreamSkipUntil = 0;
    return { ok: true, data: data as T };
  } catch (e) {
    upstreamSkipUntil = Date.now() + COOLDOWN_MS;
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "fetch failed"
          : e.message
        : "Upstream error";
    return { ok: false, status: 500, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
