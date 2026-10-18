/**
 * Typed fetch client for the GLAMO Nepal Hono API (`/api/v1`). Every call
 * carries the Firebase ID token as Bearer. Parses the `{success,data,errors,meta}`
 * envelope, maps `errors[0]` to ApiError.code, retries once on 401 with a
 * forced token refresh, and reports 401/403 to the auth layer.
 */
import { ApiError, codeFromErrors } from "./errors";
import type { Envelope, Paged } from "./types";

export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "https://api.glamonepal.com").replace(/\/+$/, "");
export const API_BASE = `${API_ORIGIN}/api/v1`;

type Hooks = {
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  onUnauthorized: () => void;
  onForbidden: (err: ApiError) => void;
};

const hooks: Hooks = {
  getToken: async () => null,
  onUnauthorized: () => undefined,
  onForbidden: () => undefined,
};

export function configureApi(next: Partial<Hooks>) {
  Object.assign(hooks, next);
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Return the raw Response (CSV downloads). */
  raw?: boolean;
  /** Don't fire the global 403 toast (caller handles it). */
  quiet?: boolean;
}

export function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function send(method: string, path: string, opts: RequestOptions, forceRefresh: boolean): Promise<Response> {
  const token = await hooks.getToken(forceRefresh);
  const headers: Record<string, string> = { Accept: opts.raw ? "*/*" : "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const multipart = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !multipart) headers["Content-Type"] = "application/json";
  try {
    return await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body === undefined ? undefined : multipart ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  }
}

async function parseEnvelope<T>(res: Response): Promise<Envelope<T>> {
  const text = await res.text();
  if (!text) return { success: res.ok } as Envelope<T>;
  try {
    return JSON.parse(text) as Envelope<T>;
  } catch {
    return { success: false, message: text.slice(0, 200) } as Envelope<T>;
  }
}

export async function requestRaw(method: string, path: string, opts: RequestOptions = {}): Promise<Response> {
  let res = await send(method, path, opts, false);
  if (res.status === 401) res = await send(method, path, opts, true);
  if (!res.ok) await throwFor(res, opts);
  return res;
}

async function throwFor(res: Response, opts: RequestOptions): Promise<never> {
  const env = await parseEnvelope<unknown>(res);
  const err = new ApiError(env.message || res.statusText || "Request failed", res.status, codeFromErrors(env.errors, res.status), (env.errors ?? []).map(String));
  if (res.status === 401) hooks.onUnauthorized();
  else if (res.status === 403 && !opts.quiet) hooks.onForbidden(err);
  throw err;
}

export async function requestEnvelope<T>(method: string, path: string, opts: RequestOptions = {}): Promise<Envelope<T>> {
  let res = await send(method, path, opts, false);
  if (res.status === 401) res = await send(method, path, opts, true);
  if (!res.ok) await throwFor(res, opts);
  const env = await parseEnvelope<T>(res);
  if (env.success === false) {
    throw new ApiError(env.message || "Request failed", res.status, codeFromErrors(env.errors, res.status), (env.errors ?? []).map(String));
  }
  return env;
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const env = await requestEnvelope<T>(method, path, opts);
  return env.data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, opts: Omit<RequestOptions, "query"> = {}) => request<T>("GET", path, { ...opts, query }),
  post: <T>(path: string, body?: unknown, opts: RequestOptions = {}) => request<T>("POST", path, { ...opts, body: body ?? {} }),
  patch: <T>(path: string, body?: unknown, opts: RequestOptions = {}) => request<T>("PATCH", path, { ...opts, body: body ?? {} }),
  del: <T>(path: string, opts: RequestOptions = {}) => request<T>("DELETE", path, opts),
  /** multipart/form-data upload of one file (field `file`). */
  upload: <T>(path: string, file: Blob, field = "file") => {
    const form = new FormData();
    form.append(field, file);
    return request<T>("POST", path, { body: form });
  },
  /** Paginated list: returns items + meta (falls back to legacy `pagination`). */
  async list<T>(path: string, query?: Query): Promise<Paged<T>> {
    const env = await requestEnvelope<T[]>("GET", path, { query });
    const items = Array.isArray(env.data) ? env.data : [];
    const meta = env.meta ?? env.pagination;
    return { items, page: meta?.page ?? 1, limit: meta?.limit ?? items.length, total: meta?.total ?? items.length };
  },
};
