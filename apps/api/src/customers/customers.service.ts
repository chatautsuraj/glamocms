import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(phone?: string) {
    const where: Prisma.CustomerWhereInput = {};
    if (phone?.trim()) {
      where.phone = { contains: phone.trim() };
    }
    return this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orders: true } } },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { items: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        sourceChannel: dto.sourceChannel,
      },
    });
  }

  async findOrCreateByPhone(name: string, phone?: string, sourceChannel?: CreateCustomerDto['sourceChannel']) {
    if (phone?.trim()) {
      const existing = await this.prisma.customer.findFirst({
        where: { phone: phone.trim() },
      });
      if (existing) return existing;
    }
    return this.create({ name, phone, sourceChannel });
  }
}
