import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(orderId?: string) {
    return this.prisma.paymentConfirmation.findMany({
      where: orderId ? { orderId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async confirm(dto: {
    orderId?: string;
    provider?: string;
    externalRef?: string;
    amount?: number;
    raw?: string;
  }) {
    let amount = dto.amount ?? 0;
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (!amount) amount = Number(order.amount);
      await this.prisma.order.update({
        where: { id: dto.orderId },
        data: { paymentStatus: PaymentStatus.paid },
      });
    }

    return this.prisma.paymentConfirmation.create({
      data: {
        orderId: dto.orderId,
        provider: dto.provider ?? 'fonepay',
        externalRef: dto.externalRef,
        amount: new Prisma.Decimal(amount),
        status: 'confirmed',
        raw: dto.raw,
      },
    });
  }
}
