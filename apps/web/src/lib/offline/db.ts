/**
 * IndexedDB (Dexie) for offline selling. The ONLY local persistence of
 * business data in GLAMO POS — nothing goes to localStorage.
 *  - products:     GET /pos/catalog snapshot (+ deltas), with normalised scan codes
 *  - pendingSales: queued POST /pos/sales payloads keyed by uuid clientRef
 *  - syncResults:  outcome of each synced sale (conflicts stay until resolved)
 *  - meta:         serverTime cursor, device id, offline bill sequence, cached session
 */
import Dexie, { type Table } from "dexie";
import type { BillData, PosProduct, SalePayload, SyncResult } from "@/lib/api/types";

export interface CachedProduct extends PosProduct {
  /** Upper-cased product + variant barcodes/SKUs for scanner lookups. */
  codes: string[];
  nameLower: string;
}

export type PendingStatus = "pending" | "syncing" | "error";

export interface PendingSale {
  clientRef: string;
  payload: SalePayload;
  provisionalRef: string;
  bill: BillData;
  total: number;
  status: PendingStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  /** Server said `error` (validation) — needs a manager's eyes. */
  needsAttention: boolean;
  createdAt: number;
}

export interface StoredSyncResult extends SyncResult {
  provisionalRef: string;
  total: number;
  syncedAt: number;
  /** Conflicts stay visible until a manager acknowledges / resolves them. */
  acknowledged: boolean;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class PosDatabase extends Dexie {
  products!: Table<CachedProduct, string>;
  pendingSales!: Table<PendingSale, string>;
  syncResults!: Table<StoredSyncResult, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = "glamo-pos") {
    super(name);
    this.version(1).stores({
      products: "id, *codes, nameLower, category, brand",
      pendingSales: "clientRef, status, nextAttemptAt, createdAt",
      syncResults: "clientRef, status, syncedAt",
      meta: "key",
    });
  }
}

let instance: PosDatabase | null = null;

export function db(): PosDatabase {
  if (!instance) instance = new PosDatabase();
  return instance;
}

/** Tests: swap in an isolated database. */
export function setDb(next: PosDatabase | null) {
  instance = next;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db().meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db().meta.put({ key, value });
}

export function productCodes(p: PosProduct): string[] {
  const codes = new Set<string>();
  const add = (c: string | null | undefined) => {
    const v = c?.trim().toUpperCase();
    if (v) codes.add(v);
  };
  add(p.barcode);
  add(p.sku);
  for (const v of p.variants ?? []) {
    add(v.barcode);
    add(v.sku);
  }
  return [...codes];
}

export function toCached(p: PosProduct): CachedProduct {
  return { ...p, codes: productCodes(p), nameLower: p.name.toLowerCase() };
}
