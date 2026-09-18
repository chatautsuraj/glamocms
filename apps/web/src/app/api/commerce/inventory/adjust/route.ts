import { NextRequest, NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await glamoApi("/inventory/adjust", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Stock adjust failed", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ product: result.data });
}
