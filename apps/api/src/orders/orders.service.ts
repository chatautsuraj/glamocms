import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FulfillmentStatus,
  OrderChannel,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { DeliveryPartnerService } from '../delivery/delivery-partner.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto } from './dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly deliveryPartner: DeliveryPartnerService,
  ) {}

  findAll(
    channel?: OrderChannel,
    paymentStatus?: PaymentStatus,
    fulfillmentStatus?: FulfillmentStatus,
  ) {
    const where: Prisma.OrderWhereInput = {};
    if (channel) where.channel = channel;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;
    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(dto: CreateOrderDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Order must include at least one item');
    }

    const qtyByProduct = new Map<string, number>();
    for (const line of dto.items) {
      if (!Number.isInteger(line.qty) || line.qty <= 0) {
        throw new BadRequestException('Quantities must be positive whole numbers');
      }
      qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.qty);
    }

    return this.prisma.$transaction(async (tx) => {
      let customerId = dto.customerId ?? null;
      if (customerId) {
        const existing = await tx.customer.findUnique({ where: { id: customerId } });
        if (!existing) throw new NotFoundException('Customer not found');
      } else if (dto.customer?.name) {
        const phone = dto.customer.phone?.trim();
        if (phone) {
          const byPhone = await tx.customer.findFirst({ where: { phone } });
          if (byPhone) customerId = byPhone.id;
        }
        if (!customerId) {
          const created = await tx.customer.create({
            data: {
              name: dto.customer.name,
              phone: phone || dto.customer.phone,
              email: dto.customer.email,
              sourceChannel: dto.channel,
            },
          });
          customerId = created.id;
        }
      }

      const lineRows: {
        productId: string;
        qty: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }[] = [];

      let amount = new Prisma.Decimal(0);

      for (const [productId, qty] of qtyByProduct) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) {
          throw new NotFoundException(`Product ${productId} not found`);
        }
        if (product.isTester) {
          throw new BadRequestException(`${product.name} is a tester and cannot be sold`);
        }
        const unitPrice = product.price;
        const lineTotal = unitPrice.mul(qty);
        amount = amount.add(lineTotal);
        lineRows.push({ productId, qty, unitPrice, lineTotal });
      }

      for (const line of lineRows) {
        await this.inventory.decrementStock(line.productId, line.qty, tx);
      }

      const scheduled = dto.deliveryScheduledAt
        ? new Date(dto.deliveryScheduledAt)
        : null;

      return tx.order.create({
        data: {
          customerId,
          amount,
          paymentStatus: dto.paymentStatus ?? PaymentStatus.unpaid,
          fulfillmentStatus: dto.fulfillmentStatus ?? FulfillmentStatus.pending,
          channel: dto.channel,
          deliveryAssignee: dto.deliveryAssignee,
          deliveryAddress: dto.deliveryAddress,
          deliveryNotes: dto.deliveryNotes,
          deliveryScheduledAt: scheduled,
          items: {
            create: lineRows.map((l) => ({
              productId: l.productId,
              qty: l.qty,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });
    });
  }

  async update(id: string, dto: UpdateOrderDto) {
    await this.findOne(id);
    return this.prisma.order.update({
      where: { id },
      data: {
        paymentStatus: dto.paymentStatus,
        fulfillmentStatus: dto.fulfillmentStatus,
        deliveryAssignee: dto.deliveryAssignee,
        deliveryAddress: dto.deliveryAddress,
        deliveryNotes: dto.deliveryNotes,
        deliveryScheduledAt:
          dto.deliveryScheduledAt === null
            ? null
            : dto.deliveryScheduledAt
              ? new Date(dto.deliveryScheduledAt)
              : undefined,
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });
  }

  async cancel(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.fulfillmentStatus === FulfillmentStatus.cancelled) {
        throw new BadRequestException('Order already cancelled');
      }

      for (const item of order.items) {
        await this.inventory.incrementStock(item.productId, item.qty, tx);
      }

      return tx.order.update({
        where: { id },
        data: {
          fulfillmentStatus: FulfillmentStatus.cancelled,
          paymentStatus: PaymentStatus.cancelled,
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });
    });
  }

  async dispatchToPartner(id: string) {
    const order = await this.findOne(id);
    if (!order.deliveryAddress?.trim()) {
      throw new BadRequestException('Set a delivery address before dispatching');
    }
    if (order.fulfillmentStatus === FulfillmentStatus.cancelled) {
      throw new BadRequestException('Cannot dispatch a cancelled order');
    }

    const result = await this.deliveryPartner.dispatch({
      orderId: order.id,
      amount: Number(order.amount),
      customerName: order.customer?.name ?? 'Customer',
      customerPhone: order.customer?.phone,
      address: order.deliveryAddress,
      notes: order.deliveryNotes,
    });

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        deliveryPartner: result.partner,
        deliveryExternalId: result.externalId,
        fulfillmentStatus:
          result.partner === 'manual'
            ? FulfillmentStatus.confirmed
            : FulfillmentStatus.out_for_delivery,
        deliveryNotes: [order.deliveryNotes, `Partner: ${result.partner} · ${result.externalId}`]
          .filter(Boolean)
          .join(' | '),
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    return { order: updated, partner: result };
  }
}
