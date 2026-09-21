import { NextRequest, NextResponse } from "next/server";
import { glamoApi, isRemoteApiConfigured } from "@/lib/server-api";

export const runtime = "nodejs";

export async function GET() {
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ current: null, shifts: [], source: "offline" });
  }
  const [current, list] = await Promise.all([
    glamoApi("/till/current"),
    glamoApi("/till"),
  ]);
  return NextResponse.json({
    current: current.ok ? current.data : null,
    shifts: list.ok ? list.data : [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ error: "API offline" }, { status: 503 });
  }
  const action = String(body.action ?? "open");
  if (action === "close") {
    const id = String(body.id ?? "");
    const result = await glamoApi(`/till/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ closingCash: Number(body.closingCash), notes: body.notes }),
    });
    if (!result.ok) {
      return NextResponse.json({ error: "Close till failed", detail: result.error }, { status: result.status });
    }
    return NextResponse.json({ shift: result.data });
  }
  const result = await glamoApi("/till/open", {
    method: "POST",
    body: JSON.stringify({
      cashierName: body.cashierName,
      openingFloat: Number(body.openingFloat ?? 0),
      notes: body.notes,
    }),
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Open till failed", detail: result.error }, { status: result.status });
  }
  return NextResponse.json({ shift: result.data });
}
