import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  list() {
    return this.prisma.saleReturn.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { lines: { include: { product: true } } },
    });
  }

  async create(dto: {
    orderId: string;
    reason?: string;
    items?: Array<{ productId: string; qty: number }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.fulfillmentStatus === 'cancelled') {
        throw new BadRequestException('Cannot return a cancelled order');
      }

      const lines =
        dto.items?.length
          ? dto.items
          : order.items.map((i) => ({ productId: i.productId, qty: i.qty }));

      let amount = new Prisma.Decimal(0);
      for (const line of lines) {
        if (!Number.isInteger(line.qty) || line.qty <= 0) {
          throw new BadRequestException('Return qty must be positive');
        }
        const sold = order.items.find((i) => i.productId === line.productId);
        if (!sold) {
          throw new BadRequestException(`Product ${line.productId} not on order`);
        }
        if (line.qty > sold.qty) {
          throw new BadRequestException(
            `Return qty ${line.qty} exceeds sold ${sold.qty}`,
          );
        }
        amount = amount.add(sold.unitPrice.mul(line.qty));
        await this.inventory.incrementStock(line.productId, line.qty, tx);
        await tx.stockAdjustment.create({
          data: {
            productId: line.productId,
            delta: line.qty,
            reason: 'return',
            note: `Return of order ${order.id}`,
          },
        });
      }

      const saleReturn = await tx.saleReturn.create({
        data: {
          orderId: order.id,
          amount,
          reason: dto.reason,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId,
              qty: l.qty,
            })),
          },
        },
        include: { lines: { include: { product: true } } },
      });

      const fullReturn =
        lines.length === order.items.length &&
        lines.every((l) => {
          const sold = order.items.find((i) => i.productId === l.productId)!;
          return l.qty === sold.qty;
        });

      if (fullReturn) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            fulfillmentStatus: 'cancelled',
            paymentStatus: 'cancelled',
            deliveryNotes: [order.deliveryNotes, `Returned: ${saleReturn.id}`]
              .filter(Boolean)
              .join(' | '),
          },
        });
      } else {
        await tx.order.update({
          where: { id: order.id },
          data: {
            deliveryNotes: [
              order.deliveryNotes,
              `Partial return ${saleReturn.id} · ${amount}`,
            ]
              .filter(Boolean)
              .join(' | '),
          },
        });
      }

      return saleReturn;
    });
  }
}
