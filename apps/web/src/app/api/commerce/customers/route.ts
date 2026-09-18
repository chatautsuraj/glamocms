import { NextRequest, NextResponse } from "next/server";
import { glamoApi, isRemoteApiConfigured } from "@/lib/server-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ customers: [], source: "offline" });
  }
  const phone = req.nextUrl.searchParams.get("phone") ?? undefined;
  const sp = new URLSearchParams();
  if (phone) sp.set("phone", phone);
  const path = `/customers${sp.toString() ? `?${sp}` : ""}`;
  const result = await glamoApi(path);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Failed to list customers", detail: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ customers: result.data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const payload = {
    name: String(body.name ?? "").trim(),
    phone: body.phone ? String(body.phone).trim() : undefined,
    email: body.email ? String(body.email).trim() : undefined,
    sourceChannel: body.sourceChannel ?? "store",
  };
  if (!payload.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!isRemoteApiConfigured()) {
    return NextResponse.json(
      { error: "Failed to create customer", detail: "fetch failed" },
      { status: 503 },
    );
  }
  const result = await glamoApi("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "Failed to create customer", detail: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ customer: result.data });
}
