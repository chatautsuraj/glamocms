import { NextRequest, NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await glamoApi(`/orders/${id}/dispatch`, { method: "POST", body: "{}" });
  if (!result.ok) {
    const detail =
      typeof result.error === "object" && result.error && "message" in (result.error as object)
        ? (result.error as { message: unknown }).message
        : result.error;
    return NextResponse.json(
      { error: typeof detail === "string" ? detail : "Dispatch failed", detail: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
