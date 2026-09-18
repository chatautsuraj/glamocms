import { Controller, Get } from '@nestjs/common';
import { FulfillmentStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const orders = await this.prisma.order.findMany({
      where: {
        fulfillmentStatus: { not: FulfillmentStatus.cancelled },
      },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });

    const sumAmount = (list: typeof orders) =>
      list.reduce((s, o) => s + Number(o.amount), 0);

    const todayOrders = orders.filter((o) => o.createdAt >= startOfToday);
    const weekOrders = orders.filter((o) => o.createdAt >= startOfWeek);

    const byFulfillment: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    for (const o of orders) {
      byFulfillment[o.fulfillmentStatus] = (byFulfillment[o.fulfillmentStatus] ?? 0) + 1;
      byChannel[o.channel] = (byChannel[o.channel] ?? 0) + 1;
    }

    const products = await this.prisma.product.findMany({
      where: { isTester: false },
      select: { stock: true, reorderAt: true },
    });
    const lowStockCount = products.filter((p) => p.stock <= p.reorderAt).length;

    const pendingDeliveries = orders.filter(
      (o) =>
        o.fulfillmentStatus === FulfillmentStatus.out_for_delivery ||
        o.fulfillmentStatus === FulfillmentStatus.packed ||
        o.fulfillmentStatus === FulfillmentStatus.confirmed,
    ).length;

    return {
      todaySales: sumAmount(todayOrders),
      weekSales: sumAmount(weekOrders),
      orderCount: orders.length,
      pendingDeliveries,
      lowStockCount,
      paidOrderCount: orders.filter((o) => o.paymentStatus === PaymentStatus.paid).length,
      byFulfillment,
      byChannel,
      recentOrders: orders.slice(0, 10).map((o) => ({
        ...o,
        amount: Number(o.amount),
      })),
    };
  }
}
