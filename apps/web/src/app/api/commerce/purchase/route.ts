import { NextRequest, NextResponse } from "next/server";
import { glamoApi, isRemoteApiConfigured } from "@/lib/server-api";

export const runtime = "nodejs";

export async function GET() {
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ receipts: [], source: "offline" });
  }
  const result = await glamoApi("/purchase");
  if (!result.ok) {
    return NextResponse.json({ error: "Failed to list receipts", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ receipts: result.data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ error: "API offline" }, { status: 503 });
  }
  const result = await glamoApi("/purchase/receive", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Receive failed", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ receipt: result.data });
}
