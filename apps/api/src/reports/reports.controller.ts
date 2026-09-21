import { Controller, Get, Query } from '@nestjs/common';
import { FulfillmentStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Sales by SKU with estimated margin (price − costPrice). */
  @Get('margin')
  async margin(@Query('days') daysRaw?: string) {
    const days = Math.min(Math.max(Number(daysRaw) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        fulfillmentStatus: { not: FulfillmentStatus.cancelled },
        paymentStatus: { not: PaymentStatus.cancelled },
      },
      include: { items: { include: { product: true } } },
    });

    const bySku = new Map<
      string,
      {
        productId: string;
        sku: string;
        name: string;
        qty: number;
        revenue: number;
        cost: number;
        margin: number;
      }
    >();

    for (const o of orders) {
      for (const item of o.items) {
        const key = item.productId;
        const row = bySku.get(key) ?? {
          productId: item.productId,
          sku: item.product.sku,
          name: item.product.name,
          qty: 0,
          revenue: 0,
          cost: 0,
          margin: 0,
        };
        const rev = Number(item.lineTotal);
        const cost = Number(item.product.costPrice) * item.qty;
        row.qty += item.qty;
        row.revenue += rev;
        row.cost += cost;
        row.margin = row.revenue - row.cost;
        bySku.set(key, row);
      }
    }

    const rows = [...bySku.values()].sort((a, b) => b.margin - a.margin);
    const totals = rows.reduce(
      (s, r) => ({
        revenue: s.revenue + r.revenue,
        cost: s.cost + r.cost,
        margin: s.margin + r.margin,
        qty: s.qty + r.qty,
      }),
      { revenue: 0, cost: 0, margin: 0, qty: 0 },
    );

    return { days, since: since.toISOString(), totals, rows };
  }

  /** Cashier / till shifts + store channel sales in period. */
  @Get('cashier')
  async cashier(@Query('days') daysRaw?: string) {
    const days = Math.min(Math.max(Number(daysRaw) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const shifts = await this.prisma.tillShift.findMany({
      where: { openedAt: { gte: since } },
      orderBy: { openedAt: 'desc' },
    });

    const storeOrders = await this.prisma.order.findMany({
      where: {
        channel: 'store',
        createdAt: { gte: since },
        fulfillmentStatus: { not: FulfillmentStatus.cancelled },
      },
    });

    const byDay = new Map<string, { count: number; amount: number; paid: number }>();
    for (const o of storeOrders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const row = byDay.get(day) ?? { count: 0, amount: 0, paid: 0 };
      row.count += 1;
      row.amount += Number(o.amount);
      if (o.paymentStatus === PaymentStatus.paid || o.paymentStatus === PaymentStatus.partial) {
        row.paid += Number(o.amount);
      }
      byDay.set(day, row);
    }

    return {
      days,
      shifts: shifts.map((s) => ({
        ...s,
        openingFloat: Number(s.openingFloat),
        closingCash: s.closingCash != null ? Number(s.closingCash) : null,
        expectedCash: s.expectedCash != null ? Number(s.expectedCash) : null,
        variance:
          s.closingCash != null && s.expectedCash != null
            ? Number(s.closingCash) - Number(s.expectedCash)
            : null,
      })),
      daily: [...byDay.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }
}
