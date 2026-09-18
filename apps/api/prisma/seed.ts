import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

type CatalogRow = {
  sourceId: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  image?: string;
};

async function main() {
  const catalogPath = join(
    __dirname,
    '..',
    '..',
    'web',
    'src',
    'lib',
    'glamo-catalog.json',
  );
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as CatalogRow[];

  let upserted = 0;
  for (const row of catalog) {
    const images = row.image ? JSON.stringify([row.image]) : '[]';
    await prisma.product.upsert({
      where: { sku: row.sku },
      create: {
        name: row.name,
        sku: row.sku,
        price: row.price,
        stock: row.stock,
        category: row.category,
        brand: row.brand,
        images,
        size: (row as { size?: string }).size ?? "",
        mrp: (row as { regularPrice?: number }).regularPrice ?? row.price,
        reorderAt: (row as { reorderAt?: number }).reorderAt ?? 5,
        galla: true,
      },
      update: {
        name: row.name,
        price: row.price,
        category: row.category,
        brand: row.brand,
        images,
        size: (row as { size?: string }).size ?? "",
        mrp: (row as { regularPrice?: number }).regularPrice ?? row.price,
        // Do not overwrite live stock on re-seed
      },
    });
    upserted += 1;
  }

  console.log(`Seeded ${upserted} Glamo products from ${catalogPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
