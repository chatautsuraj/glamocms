import { NextRequest, NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";
import {
  getFallbackProducts,
  shouldUseCatalogFallback,
} from "@/lib/catalog-fallback";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (category) sp.set("category", category);
  const path = `/products${sp.toString() ? `?${sp}` : ""}`;
  const result = await glamoApi(path);
  if (!result.ok) {
    if (shouldUseCatalogFallback(result.error)) {
      const products = getFallbackProducts({ q, category });
      return NextResponse.json(
        { products, source: "catalog-fallback" },
        {
          headers: {
            "X-Glamo-Source": "catalog-fallback",
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Failed to list products", detail: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ products: result.data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await glamoApi("/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Failed to create product — Nest API offline. Host API or run locally.",
        detail: result.error,
      },
      { status: result.status },
    );
  }
  return NextResponse.json({ product: result.data });
}
