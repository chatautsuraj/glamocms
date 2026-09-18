import { NextResponse } from "next/server";
import { glamoApi, isRemoteApiConfigured } from "@/lib/server-api";
import { getFallbackLowStockCount, shouldUseCatalogFallback } from "@/lib/catalog-fallback";

export const runtime = "nodejs";
export const revalidate = 60;

function emptyAnalytics(lowStockCount = 0) {
  return {
    todaySales: 0,
    weekSales: 0,
    orderCount: 0,
    pendingDeliveries: 0,
    lowStockCount,
    paidOrderCount: 0,
    byFulfillment: {},
    byChannel: {},
    recentOrders: [],
  };
}

export async function GET() {
  if (!isRemoteApiConfigured()) {
    return NextResponse.json(
      {
        analytics: emptyAnalytics(getFallbackLowStockCount()),
        source: "catalog-fallback",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  }

  const result = await glamoApi("/analytics/summary");
  if (!result.ok) {
    if (shouldUseCatalogFallback(result.error)) {
      return NextResponse.json({
        analytics: emptyAnalytics(getFallbackLowStockCount()),
        source: "catalog-fallback",
      });
    }
    return NextResponse.json(
      { error: "Analytics failed", detail: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ analytics: result.data });
}
