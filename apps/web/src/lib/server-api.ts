const API_URL = process.env.GLAMO_API_URL ?? "http://127.0.0.1:3001/v1";
const API_KEY = process.env.GLAMO_API_KEY ?? "pos-local-dev";

export function getGlamoApiConfig() {
  return { API_URL, API_KEY };
}

export async function glamoApi<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: unknown }> {
  const { API_URL: base, API_KEY: key } = getGlamoApiConfig();
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": key,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return { ok: false, status: res.status, error: data ?? text };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Upstream error",
    };
  }
}
