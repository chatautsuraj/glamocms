/** In-memory browser storage for isolated store tests; no real user data is touched. */
const items = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => items.get(key) ?? null,
  setItem: (key: string, value: string) => { items.set(key, value); },
  removeItem: (key: string) => { items.delete(key); },
  clear: () => items.clear(),
  key: (index: number) => [...items.keys()][index] ?? null,
  get length() { return items.size; },
} });
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: globalThis.localStorage } });
