import type { Category, ProductList } from '@shop/shared';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { ProductRail } from '@/components/product-rail';
import { ScrollyHero } from '@/components/scrolly-hero';
import { CraftsmanshipSection } from '@/components/craftsmanship-section';
import { cachedApiFetch } from '@/lib/api';

// ISR: revalidated regularly and whenever admin edits catalog
export const revalidate = 60;

const EMPTY_LIST: ProductList = { items: [], total: 0, page: 1, perPage: 8, totalPages: 0 };

async function safely<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    safely(
      () => cachedApiFetch<ProductList>('/products?perPage=8&sort=newest', ['catalog']),
      EMPTY_LIST,
    ),
    safely(() => cachedApiFetch<Category[]>('/categories', ['catalog']), [] as Category[]),
  ]);

  return (
    <main className="landing-main">
      {/* 1. Cinematic Scrollytelling Hero (Matching Video Mock Reel) */}
      <ScrollyHero />

      {/* 2. Secondary Section: Sleek Horizontal Vault Product Rail */}
      <ProductRail
        products={featured.items}
        title="The Atelier Vault Collection"
        subtitle="Articulated tennis necklaces, pavé eternity bands, and flawless solitaires crafted in noble metals."
      />

      {/* 3. Category Salon Curations */}
      <section className="category-curation-section">
        <div className="container-wide">
          <div className="curation-header">
            <span className="curation-eyebrow">FOUR PILLARS OF EXCELLENCE</span>
            <h2 className="curation-title">Explore by High Jewelry Maison</h2>
          </div>

          <div className="category-salon-grid">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="category-salon-card"
              >
                <div className="category-card-overlay" />
                <div className="category-card-content">
                  <span className="category-crest">✦</span>
                  <h3 className="category-name">{cat.name}</h3>
                  <span className="category-cta">Explore Salon →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Complete Catalog Grid */}
      <section className="catalog-preview-section">
        <div className="container-wide">
          <div className="row between" style={{ marginBottom: 32, alignItems: 'flex-end' }}>
            <div>
              <span className="product-rail-eyebrow">ACTIVE ALLOCATIONS</span>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', margin: '4px 0 0' }}>
                Curated Inventory
              </h2>
            </div>
            <Link href="/products" className="btn btn-outline">
              View All 8 Creations →
            </Link>
          </div>

          {featured.items.length === 0 ? (
            <p className="empty">No active pieces currently in vault</p>
          ) : (
            <div className="products">
              {featured.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. Craftsmanship & Provenance Pillars */}
      <CraftsmanshipSection />
    </main>
  );
}
