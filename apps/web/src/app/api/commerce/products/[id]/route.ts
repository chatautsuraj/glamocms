import { NextRequest, NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await glamoApi(`/products/${id}`);
  if (!result.ok) {
    return NextResponse.json({ error: "Product not found", detail: result.error }, { status: result.status });
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
    return NextResponse.json({ error: "Failed to update product", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ product: result.data });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await glamoApi(`/products/${id}`, { method: "DELETE" });
  if (!result.ok) {
    return NextResponse.json({ error: "Failed to delete product", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
