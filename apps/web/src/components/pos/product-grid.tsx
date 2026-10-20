"use client";

import { useEffect, useRef, useState } from "react";
import { PackageSearch } from "lucide-react";
import type { CachedProduct } from "@/lib/offline/db";
import { ProductTile } from "./product-tile";

const PAGE = 48;

/**
 * Photo grid that renders tiles in pages of 48 as you scroll (IntersectionObserver)
 * plus CSS content-visibility, so a catalog of hundreds of products stays fast.
 * Give it a `key` per search/category so paging restarts from the top.
 */
export function ProductGrid({ products, inCart, onPick, query, emptyHint }: {
  products: CachedProduct[];
  inCart: ReadonlyMap<string, number>;
  onPick: (p: CachedProduct) => void;
  query: string;
  emptyHint: string;
}) {
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= products.length) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, products.length]);

  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <PackageSearch className="h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="font-medium">{query ? `Nothing matches “${query}”` : "No products here"}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" aria-label="Products">
      {products.slice(0, limit).map((p) => (
        <li key={p.id} className="cv-tile">
          <ProductTile product={p} inCart={inCart.get(p.id) ?? 0} onPick={onPick} />
        </li>
      ))}
      {limit < products.length && <li ref={sentinel} aria-hidden className="col-span-full h-10" />}
    </ul>
  );
}
