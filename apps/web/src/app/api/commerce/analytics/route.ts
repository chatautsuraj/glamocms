import { NextResponse } from "next/server";
import { glamoApi } from "@/lib/server-api";
import { getFallbackProducts, shouldUseCatalogFallback } from "@/lib/catalog-fallback";

/** Empty analytics shell when Nest is offline — browser may merge local sales. */
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
  const result = await glamoApi("/analytics/summary");
  if (!result.ok) {
    if (shouldUseCatalogFallback(result.error)) {
      const products = getFallbackProducts();
      const lowStockCount = products.filter((p) => p.stock <= (p.reorderAt ?? 5)).length;
      return NextResponse.json({
        analytics: emptyAnalytics(lowStockCount),
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
