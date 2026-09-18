import { NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";

export async function GET() {
  const result = await glamoApi("/analytics/summary");
  if (!result.ok) {
    return NextResponse.json({ error: "Analytics failed", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ analytics: result.data });
}
