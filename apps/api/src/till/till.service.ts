import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TillService {
  constructor(private readonly prisma: PrismaService) {}

  currentOpen() {
    return this.prisma.tillShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    });
  }

  list() {
    return this.prisma.tillShift.findMany({ orderBy: { openedAt: 'desc' }, take: 50 });
  }

  async open(dto: { cashierName: string; openingFloat?: number; notes?: string }) {
    const open = await this.currentOpen();
    if (open) {
      throw new BadRequestException('A till shift is already open — close it first');
    }
    return this.prisma.tillShift.create({
      data: {
        cashierName: dto.cashierName.trim(),
        openingFloat: new Prisma.Decimal(dto.openingFloat ?? 0),
        notes: dto.notes,
        status: 'open',
      },
    });
  }

  async close(id: string, dto: { closingCash: number; notes?: string }) {
    const shift = await this.prisma.tillShift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Till shift not found');
    if (shift.status !== 'open') throw new BadRequestException('Shift already closed');

    const since = shift.openedAt;
    const paid = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        paymentStatus: { in: ['paid', 'partial'] },
        fulfillmentStatus: { not: 'cancelled' },
        channel: 'store',
      },
    });
    const salesCash = paid.reduce((s, o) => s + Number(o.amount), 0);
    const expected = Number(shift.openingFloat) + salesCash;

    return this.prisma.tillShift.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closingCash: new Prisma.Decimal(dto.closingCash),
        expectedCash: new Prisma.Decimal(expected),
        notes: [shift.notes, dto.notes].filter(Boolean).join(' | ') || null,
      },
    });
  }
}
