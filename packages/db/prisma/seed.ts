/**
 * Demo catalog for the storefront: two users, three categories, eight products
 * with variants and real stock.
 *
 * Passwords: admin@shop.local / customer@shop.local, both "password123".
 *
 * Idempotent by construction: every row is written through `upsert` on a natural
 * key (email, slug, sku), so running this twice converges on the same state
 * instead of duplicating the catalog. Stock is set absolutely rather than
 * incremented, so a re-seed also resets a database an E2E run drained.
 */
import { PrismaClient, ProductStatus } from '../generated/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// If .env exists in repo root (e.g. during local dev), load it into process.env.
// In CI environments where .env is not present, environment variables are already set.
const envPath = resolve(__dirname, '../../../.env');
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

const prisma = new PrismaClient();

// Mirror of the hash format used by the web auth layer (apps/web/lib/password.ts).
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

type SeedVariant = {
  sku: string;
  name: string;
  priceCents: number;
  stockOnHand: number;
};

type SeedProduct = {
  slug: string;
  title: string;
  description: string;
  category: string;
  status?: ProductStatus;
  variants: SeedVariant[];
};

const CATEGORIES: Array<{ slug: string; name: string }> = [
  { slug: 'necklaces', name: 'Necklaces' },
  { slug: 'rings', name: 'Rings' },
  { slug: 'earrings', name: 'Earrings' },
  { slug: 'bracelets', name: 'Bracelets' },
];

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'solitaire-diamond-ring',
    title: 'Solitaire Diamond Ring',
    description:
      'Handcrafted 1.5-carat round brilliant diamond set in a classic four-prong cathedral setting. ' +
      'Exceptional fire, timeless elegance, and ethically sourced stones.',
    category: 'rings',
    variants: [
      { sku: 'RING-SOL-18K-6', name: '18k Yellow Gold / Size 6', priceCents: 249000, stockOnHand: 15 },
      { sku: 'RING-SOL-18K-7', name: '18k Yellow Gold / Size 7', priceCents: 249000, stockOnHand: 20 },
      { sku: 'RING-SOL-PLT-6', name: 'Platinum / Size 6', priceCents: 289000, stockOnHand: 10 },
      { sku: 'RING-SOL-PLT-7', name: 'Platinum / Size 7', priceCents: 289000, stockOnHand: 12 },
    ],
  },
  {
    slug: 'eternity-diamond-band',
    title: 'Eternity Diamond Band',
    description:
      'Continuous circle of pavé-set round brilliant diamonds totaling 2.0 carats. ' +
      'Designed for effortless stacking or a standalone statement of enduring brilliance.',
    category: 'rings',
    variants: [
      { sku: 'RING-ETR-WG-6', name: '18k White Gold / Size 6', priceCents: 175000, stockOnHand: 18 },
      { sku: 'RING-ETR-WG-7', name: '18k White Gold / Size 7', priceCents: 175000, stockOnHand: 14 },
      { sku: 'RING-ETR-YG-6', name: '18k Yellow Gold / Size 6', priceCents: 175000, stockOnHand: 16 },
    ],
  },
  {
    slug: 'diamond-tennis-necklace',
    title: 'Rivière Diamond Tennis Necklace',
    description:
      'Graduated rivière necklace featuring 12 carats of ethically sourced round diamonds ' +
      'set in four-prong 18k white gold articulated links with dual safety clasps.',
    category: 'necklaces',
    variants: [
      { sku: 'NCK-TEN-16', name: '16-inch / 18k White Gold', priceCents: 420000, stockOnHand: 8 },
      { sku: 'NCK-TEN-18', name: '18-inch / 18k White Gold', priceCents: 480000, stockOnHand: 6 },
    ],
  },
  {
    slug: 'akoya-pearl-strand',
    title: 'Akoya Cultured Pearl Strand',
    description:
      'Luminous 7.5-8.0mm Japanese Akoya cultured pearls, individually hand-knotted on pure silk ' +
      'thread with a filigree 14k yellow gold safety ball clasp.',
    category: 'necklaces',
    variants: [
      { sku: 'NCK-PRL-18', name: '18-inch Princess Length', priceCents: 125000, stockOnHand: 22 },
      { sku: 'NCK-PRL-20', name: '20-inch Matinee Length', priceCents: 145000, stockOnHand: 15 },
    ],
  },
  {
    slug: 'emerald-cut-pendant',
    title: 'Emerald Cut Diamond Pendant',
    description:
      'A striking 1.2-carat emerald-cut diamond suspended from a delicate 18k gold cable chain ' +
      'with adjustable jump rings at 16, 17, and 18 inches.',
    category: 'necklaces',
    variants: [
      { sku: 'NCK-EM-YG', name: '18k Yellow Gold', priceCents: 189000, stockOnHand: 25 },
      { sku: 'NCK-EM-PLT', name: 'Platinum', priceCents: 215000, stockOnHand: 12 },
    ],
  },
  {
    slug: 'diamond-solitaire-studs',
    title: 'Diamond Solitaire Stud Earrings',
    description:
      'Classic matching pair of round brilliant diamonds set in minimalist three-prong martini mounts ' +
      'with threaded screw-back closures for ultimate comfort and security.',
    category: 'earrings',
    variants: [
      { sku: 'EAR-SOL-1CT', name: '1.0 Total Carat Weight (14k White Gold)', priceCents: 110000, stockOnHand: 30 },
      { sku: 'EAR-SOL-2CT', name: '2.0 Total Carat Weight (Platinum)', priceCents: 260000, stockOnHand: 15 },
    ],
  },
  {
    slug: 'pave-diamond-huggie-hoops',
    title: 'Pavé Diamond Huggie Hoops',
    description:
      'Petite 12mm huggie hoops encrusted with micro-pavé diamonds along the outer curve. ' +
      'Crafted for daily wear with seamless hinge and click-lock fastening.',
    category: 'earrings',
    variants: [
      { sku: 'EAR-HUG-YG', name: '14k Yellow Gold', priceCents: 65000, stockOnHand: 40 },
      { sku: 'EAR-HUG-RG', name: '14k Rose Gold', priceCents: 65000, stockOnHand: 25 },
      { sku: 'EAR-HUG-WG', name: '14k White Gold', priceCents: 65000, stockOnHand: 35 },
    ],
  },
  {
    slug: 'diamond-tennis-bracelet',
    title: 'Classic Diamond Tennis Bracelet',
    description:
      'Articulated line of matched round brilliant diamonds totaling 5.0 carats, crafted in solid ' +
      '18k white gold with double figure-eight safety catches.',
    category: 'bracelets',
    variants: [
      { sku: 'BRC-TEN-7', name: '7-inch / 18k White Gold', priceCents: 310000, stockOnHand: 12 },
      { sku: 'BRC-TEN-75', name: '7.5-inch / 18k White Gold', priceCents: 335000, stockOnHand: 10 },
    ],
  },
  {
    slug: 'royale-sapphire-choker',
    title: 'Royale Sapphire Choker',
    description: 'Exclusive unreleased atelier piece featuring royal blue Ceylon sapphires and baguette diamonds.',
    category: 'necklaces',
    status: ProductStatus.DRAFT,
    variants: [{ sku: 'NCK-SAP-DFT', name: 'Atelier Sample', priceCents: 990000, stockOnHand: 0 }],
  },
];

/**
 * Remove every product this file does not define, and everything hanging off it.
 */
async function pruneNonSeedProducts(): Promise<number> {
  const doomed = await prisma.product.findMany({
    where: { slug: { notIn: PRODUCTS.map((product) => product.slug) } },
    select: { id: true, variants: { select: { id: true } } },
  });
  if (doomed.length === 0) return 0;

  const variantIds = doomed.flatMap((product) => product.variants.map((variant) => variant.id));

  if (variantIds.length > 0) {
    const orderIds = (
      await prisma.orderItem.findMany({
        where: { variantId: { in: variantIds } },
        select: { orderId: true },
        distinct: ['orderId'],
      })
    ).map((item) => item.orderId);

    if (orderIds.length > 0) {
      await prisma.webhookEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
  }

  await prisma.product.deleteMany({ where: { id: { in: doomed.map((p) => p.id) } } });
  return doomed.length;
}

async function pruneNonSeedCategories(): Promise<number> {
  const doomed = await prisma.category.findMany({
    where: { slug: { notIn: CATEGORIES.map((c) => c.slug) } },
    select: { id: true },
  });
  if (doomed.length === 0) return 0;
  await prisma.category.deleteMany({ where: { id: { in: doomed.map((c) => c.id) } } });
  return doomed.length;
}

async function main() {
  const prunedProducts = await pruneNonSeedProducts();
  if (prunedProducts > 0) {
    console.log(`Pruned ${prunedProducts} non-jewelry product(s).`);
  }

  const prunedCategories = await pruneNonSeedCategories();
  if (prunedCategories > 0) {
    console.log(`Pruned ${prunedCategories} non-jewelry category/categories.`);
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@shop.local' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@shop.local',
      name: 'Store Admin',
      passwordHash: hashPassword('password123'),
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@shop.local' },
    update: {},
    create: {
      email: 'customer@shop.local',
      name: 'Demo Customer',
      passwordHash: hashPassword('password123'),
      role: 'CUSTOMER',
    },
  });

  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
    categoryIds.set(category.slug, row.id);
  }

  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`seed: unknown category ${product.category}`);

    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        title: product.title,
        description: product.description,
        status: product.status ?? ProductStatus.ACTIVE,
        categoryId,
      },
      create: {
        slug: product.slug,
        title: product.title,
        description: product.description,
        status: product.status ?? ProductStatus.ACTIVE,
        categoryId,
      },
    });

    for (const [position, variant] of product.variants.entries()) {
      const variantRow = await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: {
          productId: row.id,
          name: variant.name,
          priceCents: variant.priceCents,
          stockOnHand: variant.stockOnHand,
          stockReserved: 0,
          position,
        },
        create: {
          productId: row.id,
          sku: variant.sku,
          name: variant.name,
          priceCents: variant.priceCents,
          stockOnHand: variant.stockOnHand,
          stockReserved: 0,
          position,
        },
      });

      // Clear existing ledger entries for this variant and record initial RESTOCK
      await prisma.stockLedger.deleteMany({ where: { variantId: variantRow.id } });
      if (variant.stockOnHand > 0) {
        await prisma.stockLedger.create({
          data: {
            variantId: variantRow.id,
            kind: 'RESTOCK',
            onHandDelta: variant.stockOnHand,
            reservedDelta: 0,
            reason: 'Initial luxury jewelry catalog stock',
            actorId: admin.id,
          },
        });
      }
    }
  }

  const variantCount = await prisma.productVariant.count();
  console.log(
    `Seeded ${CATEGORIES.length} categories, ${PRODUCTS.length} products, ` +
      `${variantCount} variants. Admin: ${admin.email} / password123`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
