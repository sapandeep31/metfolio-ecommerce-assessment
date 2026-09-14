import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '../packages/db/generated/client';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prisma = new PrismaClient();

interface ImageConfig {
  slug: string;
  expectedId?: string;
  sourceJpg: string;
  alt: string;
}

const IMAGES: ImageConfig[] = [
  {
    slug: 'solitaire-diamond-ring',
    expectedId: 'cmu1ebgf90007px7leb9oe7cd',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/solitaire_diamond_ring_1789399938632.jpg',
    alt: '18k yellow gold solitaire ring with 1.5-carat round brilliant diamond in four-prong cathedral setting',
  },
  {
    slug: 'eternity-diamond-band',
    expectedId: 'cmu1ebinj000ppx7l3kjl8ce4',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/eternity_diamond_band_1789399958721.jpg',
    alt: '18k white gold eternity band set with pavé diamonds in a continuous circle',
  },
  {
    slug: 'diamond-tennis-necklace',
    expectedId: 'cmu1ebkae0013px7l45wxc42e',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/diamond_tennis_necklace_1789399980294.jpg',
    alt: '18k white gold graduated Rivière diamond tennis necklace on black velvet bust',
  },
  {
    slug: 'akoya-pearl-strand',
    expectedId: 'cmu1ebll4001dpx7ljykaiw5s',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/akoya_pearl_strand_1789400006078.jpg',
    alt: 'Luminous 8mm Japanese Akoya cultured pearl strand with 14k gold filigree ball clasp on silk',
  },
  {
    slug: 'emerald-cut-pendant',
    expectedId: 'cmu1ebmpb001npx7lm8svjbsj',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/emerald_cut_pendant_1789400027327.jpg',
    alt: '1.2-carat emerald-cut diamond pendant on 18k gold chain resting on brass pedestal',
  },
  {
    slug: 'diamond-solitaire-studs',
    expectedId: 'cmu1ebnwm001xpx7lzld65adh',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/diamond_solitaire_studs_1789400049659.jpg',
    alt: 'Brilliant round diamond stud earrings in three-prong platinum martini settings on slate stone',
  },
  {
    slug: 'pave-diamond-huggie-hoops',
    expectedId: 'cmu1ebp9d0027px7lmopbtiua',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/pave_huggie_hoops_1789400073939.jpg',
    alt: 'Pair of 14k yellow gold petite huggie hoop earrings encrusted with micro-pavé diamonds on brass stand',
  },
  {
    slug: 'diamond-tennis-bracelet',
    expectedId: 'cmu1ebqyi002lpx7lgemyjatl',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/diamond_tennis_bracelet_1789400097816.jpg',
    alt: 'Articulated 5-carat round brilliant diamond tennis bracelet in solid 18k white gold over handmade paper',
  },
  {
    slug: 'royale-sapphire-choker',
    expectedId: 'cmu1ebs90002vpx7l2c9lhk2u',
    sourceJpg:
      '/Users/sap/.gemini/antigravity-ide/brain/67d5ef25-6160-40d9-848c-31fe82de44c4/sapphire_choker_1789400135625.jpg',
    alt: 'Art deco royal blue Ceylon sapphire and baguette diamond choker necklace on deep velvet',
  },
];

async function main() {
  console.log('=== Metfolio Atelier: Upload & Attach Luxury Jewelry Images ===\n');

  // 1. Ensure bucket exists and is public
  const bucketName = 'product-images';
  const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
  if (bucketListError) {
    throw new Error(`Failed to list buckets: ${bucketListError.message}`);
  }

  const existingBucket = buckets.find((b) => b.name === bucketName);
  if (!existingBucket) {
    console.log(`Creating bucket "${bucketName}" (public: true)...`);
    const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
    });
    if (createBucketError) throw createBucketError;
  } else {
    console.log(`Bucket "${bucketName}" already exists (public: ${existingBucket.public}).`);
    if (!existingBucket.public) {
      console.log(`Updating bucket "${bucketName}" to be public...`);
      await supabase.storage.updateBucket(bucketName, { public: true });
    }
  }

  const outputDir = resolve(__dirname, '../var/converted-images');
  mkdirSync(outputDir, { recursive: true });

  for (const item of IMAGES) {
    console.log(`\nProcessing: ${item.slug}`);

    // Verify product exists in database
    const product = await prisma.product.findUnique({
      where: { slug: item.slug },
      select: { id: true, slug: true, title: true },
    });

    if (!product) {
      console.warn(`⚠️ Product with slug "${item.slug}" not found in database! Skipping.`);
      continue;
    }

    // Convert source JPG to WebP using cwebp
    const webpPath = resolve(outputDir, `${item.slug}.webp`);
    if (!existsSync(item.sourceJpg)) {
      throw new Error(`Source JPG not found at: ${item.sourceJpg}`);
    }

    execFileSync('/opt/homebrew/bin/cwebp', ['-q', '92', item.sourceJpg, '-o', webpPath]);
    const webpBuffer = readFileSync(webpPath);
    console.log(`  Converted to WebP: ${webpBuffer.length} bytes`);

    // Upload to Supabase Storage
    const storagePath = `${item.slug}/hero.webp`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, webpBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${storagePath}: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;
    console.log(`  Uploaded to Supabase: ${publicUrl}`);

    // Update database record
    await prisma.productImage.deleteMany({
      where: { productId: product.id },
    });

    const newImage = await prisma.productImage.create({
      data: {
        productId: product.id,
        storageKey: publicUrl,
        alt: item.alt,
        position: 0,
      },
    });

    console.log(`  Linked in DB: Image ID ${newImage.id} -> Product ${product.id}`);
  }

  console.log('\n=== All Product Images Successfully Processed & Linked! ===\n');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
