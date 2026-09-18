import { NextRequest, NextResponse } from "next/server";
import { glamoApi, isRemoteApiConfigured } from "@/lib/server-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isRemoteApiConfigured()) {
    return NextResponse.json({ orders: [], source: "offline" });
  }
  const sp = req.nextUrl.searchParams;
  const qs = sp.toString();
  const result = await glamoApi(`/orders${qs ? `?${qs}` : ""}`);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Failed to list orders", detail: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ orders: result.data });
}

/**
 * Create order. Accepts either:
 * - { items: [{ productId, qty }], ... } (API ids)
 * - { items: [{ sku, qty }], customerName?, ... } (POS convenience)
 *
 * Always forwards a Nest-safe payload (forbidNonWhitelisted on API).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!isRemoteApiConfigured()) {
    return NextResponse.json(
      { error: "API order failed", detail: "fetch failed" },
      { status: 503 },
    );
  }

  let items: { productId: string; qty: number }[] = [];

  if (Array.isArray(body.items) && body.items[0]?.sku && !body.items[0]?.productId) {
    const productsRes = await glamoApi<{ id: string; sku: string }[]>("/products");
    if (!productsRes.ok) {
      return NextResponse.json({ error: "API products fetch failed", detail: productsRes.error }, { status: 502 });
    }
    const bySku = new Map(productsRes.data.map((p) => [p.sku, p.id]));
    for (const line of body.items) {
      const productId = bySku.get(String(line.sku));
      if (!productId) {
        return NextResponse.json({ error: `Unknown SKU ${line.sku}` }, { status: 400 });
      }
      items.push({ productId, qty: Number(line.qty) });
    }
  } else if (Array.isArray(body.items)) {
    items = body.items.map((line: { productId: string; qty: number }) => ({
      productId: String(line.productId),
      qty: Number(line.qty),
    }));
  }

  if (!items.length) {
    return NextResponse.json({ error: "Order must include at least one item" }, { status: 400 });
  }

  const customer =
    body.customer?.name
      ? {
          name: String(body.customer.name),
          ...(body.customer.phone && body.customer.phone !== "—"
            ? { phone: String(body.customer.phone) }
            : {}),
          ...(body.customer.email ? { email: String(body.customer.email) } : {}),
        }
      : body.customerName
        ? {
            name: String(body.customerName),
            ...(body.customerPhone && body.customerPhone !== "—"
              ? { phone: String(body.customerPhone) }
              : {}),
          }
        : undefined;

  const payload: Record<string, unknown> = {
    channel: body.channel ?? "store",
    items,
  };

  if (body.paymentStatus) payload.paymentStatus = body.paymentStatus;
  if (body.fulfillmentStatus) payload.fulfillmentStatus = body.fulfillmentStatus;
  if (body.customerId && body.customerId !== "walk-in") payload.customerId = body.customerId;
  if (customer) payload.customer = customer;
  if (body.deliveryAddress) payload.deliveryAddress = body.deliveryAddress;
  if (body.deliveryNotes) payload.deliveryNotes = body.deliveryNotes;
  if (body.deliveryAssignee) payload.deliveryAssignee = body.deliveryAssignee;
  if (body.deliveryScheduledAt) payload.deliveryScheduledAt = body.deliveryScheduledAt;

  const result = await glamoApi("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    const detail =
      typeof result.error === "object" && result.error && "message" in (result.error as object)
        ? (result.error as { message: unknown }).message
        : result.error;
    return NextResponse.json(
      { error: typeof detail === "string" ? detail : "API order failed", detail: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true, order: result.data });
}
