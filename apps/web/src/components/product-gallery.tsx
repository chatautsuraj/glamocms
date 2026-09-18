"use client";
import { useState } from "react";
import { ProductPhoto } from "@/components/product-photo";
import { Button } from "@/components/ui/button";
import { formatNPR } from "@/lib/format";
import type { Product } from "@/lib/store";

export function ProductGallery({products,onEdit}:{products:Product[];onEdit:(p:Product)=>void}) {
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("");
  const filtered=products.filter(p=>(!category||p.category===category)&&[p.name,p.brand,p.sku,p.size,p.shade].join(" ").toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-3">
      <input aria-label="Search beauty products" placeholder="Search products, brands or SKU…" value={search} onChange={e=>setSearch(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm" />
      <select aria-label="Product category" value={category} onChange={e=>setCategory(e.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="">All categories</option>{[...new Set(products.map(p=>p.category))].sort().map(c=><option key={c}>{c}</option>)}</select>
    </div>
    <p className="text-sm text-muted-foreground">{filtered.length} products · {[...new Set(filtered.map(p=>p.brand))].length} brands</p>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
      {filtered.map(p=><article key={p.id} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <ProductPhoto src={p.image} name={p.name} className="aspect-square" />
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.brand}</p>
          <h2 className="text-sm font-semibold leading-relaxed">{p.name}</h2>
          <p className="text-xs text-muted-foreground">{p.size || p.category}{p.shade ? ` · ${p.shade}` : ""}</p>
          <div className="mt-auto pt-2"><span className="font-semibold">{formatNPR(p.tradePrice)}</span>{p.mrp>p.tradePrice&&<span className="ml-2 text-xs text-muted-foreground line-through">{formatNPR(p.mrp)}</span>}</div>
          <p className="text-xs text-muted-foreground">{p.stock>0?`${p.stock} in stock`:"Out of stock"} · {p.sku}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><Button size="sm" variant="outline" onClick={()=>onEdit(p)}>Edit product</Button>{p.sourceUrl&&<a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Source ↗</a>}</div>
        </div>
      </article>)}
    </div>
    {!filtered.length&&<p className="rounded-xl border p-10 text-center text-muted-foreground">No products match your search.</p>}
  </div>;
}

