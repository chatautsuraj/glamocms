import { NextRequest, NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await glamoApi(`/orders/${id}/cancel`, { method: "POST" });
  if (!result.ok) {
    return NextResponse.json({ error: "Cancel failed", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ order: result.data });
}
