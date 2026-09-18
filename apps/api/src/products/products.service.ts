import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto';

function parseImages(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function serializeImages(images?: string[]): string {
  return JSON.stringify(images ?? []);
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private map(p: {
    id: string;
    name: string;
    sku: string;
    price: Prisma.Decimal;
    stock: number;
    category: string | null;
    images: string;
    brand: string | null;
    shade: string | null;
    batchNumber: string | null;
    expiresOn: Date | null;
    isTester: boolean;
    size: string | null;
    mrp: Prisma.Decimal | null;
    reorderAt: number;
    galla: boolean;
    vatApplicable: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...p,
      price: Number(p.price),
      mrp: p.mrp != null ? Number(p.mrp) : Number(p.price),
      images: parseImages(p.images),
    };
  }

  async findAll(q?: string, category?: string) {
    const where: Prisma.ProductWhereInput = {};
    if (q?.trim()) {
      where.OR = [
        { name: { contains: q.trim() } },
        { sku: { contains: q.trim() } },
        { brand: { contains: q.trim() } },
      ];
    }
    if (category?.trim()) {
      where.category = category.trim();
    }
    const rows = await this.prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return rows.map((p) => this.map(p));
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    return this.map(p);
  }

  async create(dto: CreateProductDto) {
    const p = await this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        price: dto.price,
        stock: dto.stock ?? 0,
        category: dto.category,
        images: serializeImages(dto.images),
        brand: dto.brand,
        shade: dto.shade,
        batchNumber: dto.batchNumber,
        isTester: dto.isTester ?? false,
        size: dto.size,
        mrp: dto.mrp ?? dto.price,
        reorderAt: dto.reorderAt ?? 5,
        galla: dto.galla ?? true,
        vatApplicable: dto.vatApplicable ?? false,
      },
    });
    return this.map(p);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const p = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        price: dto.price,
        category: dto.category,
        images: dto.images ? serializeImages(dto.images) : undefined,
        brand: dto.brand,
        shade: dto.shade,
        batchNumber: dto.batchNumber,
        isTester: dto.isTester,
        size: dto.size,
        mrp: dto.mrp,
        reorderAt: dto.reorderAt,
        galla: dto.galla,
        vatApplicable: dto.vatApplicable,
      },
    });
    return this.map(p);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }
}
