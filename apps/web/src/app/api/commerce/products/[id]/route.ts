import { NextRequest, NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";
import {
  getFallbackProduct,
  shouldUseCatalogFallback,
} from "@/lib/catalog-fallback";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await glamoApi(`/products/${id}`);
  if (!result.ok) {
    if (shouldUseCatalogFallback(result.error)) {
      const product = getFallbackProduct(id);
      if (product) {
        return NextResponse.json(
          { product, source: "catalog-fallback" },
          { headers: { "X-Glamo-Source": "catalog-fallback" } },
        );
      }
    }
    return NextResponse.json(
      { error: "Product not found", detail: result.error },
      { status: result.status === 500 ? 404 : result.status },
    );
  }
  return NextResponse.json({ product: result.data });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const result = await glamoApi(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Failed to update product — Nest API offline. Host API or run locally.",
        detail: result.error,
      },
      { status: result.status },
    );
  }
  return NextResponse.json({ product: result.data });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await glamoApi(`/products/${id}`, { method: "DELETE" });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Failed to delete product — Nest API offline. Host API or run locally.",
        detail: result.error,
      },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true });
}
