import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TxClient = Prisma.TransactionClient;

/**
 * Sole writer of product stock quantities.
 * All channels (store / website / whatsapp) must call this — never update stock elsewhere.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async decrementStock(
    productId: string,
    qty: number,
    tx?: TxClient,
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new BadRequestException('Quantity must be a positive whole number');
    }

    const db = tx ?? this.prisma;
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (product.stock < qty) {
      throw new BadRequestException(
        `Insufficient stock for ${product.name}: have ${product.stock}, need ${qty}`,
      );
    }

    await db.product.update({
      where: { id: productId },
      data: { stock: product.stock - qty },
    });
  }

  async incrementStock(
    productId: string,
    qty: number,
    tx?: TxClient,
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new BadRequestException('Quantity must be a positive whole number');
    }
    const db = tx ?? this.prisma;
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    await db.product.update({
      where: { id: productId },
      data: { stock: product.stock + qty },
    });
  }
}
