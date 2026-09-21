import { NextRequest, NextResponse } from "next/server";
import { glamoApi, isRemoteApiConfigured } from "@/lib/server-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ error: "API offline", source: "offline" }, { status: 503 });
  }
  const kind = req.nextUrl.searchParams.get("kind") ?? "margin";
  const days = req.nextUrl.searchParams.get("days") ?? "30";
  const path = kind === "cashier" ? `/reports/cashier?days=${days}` : `/reports/margin?days=${days}`;
  const result = await glamoApi(path);
  if (!result.ok) {
    return NextResponse.json({ error: "Report failed", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ report: result.data, kind });
}
