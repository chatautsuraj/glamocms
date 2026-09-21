import { NextRequest, NextResponse } from "next/server";
import { glamoApi, isRemoteApiConfigured } from "@/lib/server-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ payments: [], source: "offline" });
  }
  const orderId = req.nextUrl.searchParams.get("orderId");
  const result = await glamoApi(`/payments${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`);
  if (!result.ok) {
    return NextResponse.json({ error: "Failed to list payments", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ payments: result.data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ error: "API offline" }, { status: 503 });
  }
  const result = await glamoApi("/payments/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Payment confirm failed", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ payment: result.data });
}
