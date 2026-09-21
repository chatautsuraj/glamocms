import { NextRequest, NextResponse } from "next/server";
import { glamoApi, isRemoteApiConfigured } from "@/lib/server-api";

export const runtime = "nodejs";

export async function GET() {
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ returns: [], source: "offline" });
  }
  const result = await glamoApi("/returns");
  if (!result.ok) {
    return NextResponse.json({ error: "Failed to list returns", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ returns: result.data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ error: "API offline" }, { status: 503 });
  }
  const result = await glamoApi("/returns", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Return failed", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ return: result.data });
}
