import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly products: ProductsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('adjust')
  async adjust(@Body() dto: AdjustStockDto) {
    if (!Number.isInteger(dto.qty) || dto.qty === 0) {
      throw new BadRequestException('qty must be a non-zero integer');
    }
    if (dto.qty > 0) {
      await this.inventory.incrementStock(dto.productId, dto.qty);
    } else {
      await this.inventory.decrementStock(dto.productId, Math.abs(dto.qty));
    }
    await this.prisma.stockAdjustment.create({
      data: {
        productId: dto.productId,
        delta: dto.qty,
        reason: dto.reason?.trim() || 'adjustment',
        note: dto.note,
      },
    });
    return this.products.findOne(dto.productId);
  }
}
