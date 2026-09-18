import { NextRequest, NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (category) sp.set("category", category);
  const path = `/products${sp.toString() ? `?${sp}` : ""}`;
  const result = await glamoApi(path);
  if (!result.ok) {
    return NextResponse.json({ error: "Failed to list products", detail: result.error }, { status: result.status });
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
    return NextResponse.json({ error: "Failed to create product", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ product: result.data });
}
