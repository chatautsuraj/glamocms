import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  list() {
    return this.prisma.purchaseReceipt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { lines: { include: { product: true } } },
    });
  }

  async receive(dto: {
    supplierName: string;
    reference?: string;
    notes?: string;
    lines: Array<{ productId: string; qty: number; unitCost?: number }>;
  }) {
    if (!dto.lines?.length) {
      throw new BadRequestException('At least one line required');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        if (!Number.isInteger(line.qty) || line.qty <= 0) {
          throw new BadRequestException('Line qty must be positive');
        }
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) throw new NotFoundException(`Product ${line.productId} not found`);

        await this.inventory.incrementStock(line.productId, line.qty, tx);
        await tx.stockAdjustment.create({
          data: {
            productId: line.productId,
            delta: line.qty,
            reason: 'receive',
            note: dto.reference ?? dto.supplierName,
          },
        });

        const unitCost = line.unitCost ?? Number(product.costPrice);
        if (unitCost > 0) {
          await tx.product.update({
            where: { id: line.productId },
            data: { costPrice: new Prisma.Decimal(unitCost) },
          });
        }
      }

      return tx.purchaseReceipt.create({
        data: {
          supplierName: dto.supplierName.trim(),
          reference: dto.reference,
          notes: dto.notes,
          lines: {
            create: dto.lines.map((l) => ({
              productId: l.productId,
              qty: l.qty,
              unitCost: new Prisma.Decimal(l.unitCost ?? 0),
            })),
          },
        },
        include: { lines: { include: { product: true } } },
      });
    });
  }
}
