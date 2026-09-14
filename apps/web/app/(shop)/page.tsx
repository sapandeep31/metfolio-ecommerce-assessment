import type { Category, ProductList } from '@shop/shared';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { cachedApiFetch } from '@/lib/api';

// ISR: the home page is the most-hit and least-volatile page in the store. It is
// rebuilt at most once a minute, and immediately whenever an admin edit calls
// revalidateTag('catalog').
export const revalidate = 60;

const EMPTY_LIST: ProductList = { items: [], total: 0, page: 1, perPage: 8, totalPages: 0 };

/**
 * The build must not need a running API.
 *
 * `next build` prerenders this page, and in CI or a Docker build the API is not
 * up. Failing the build over that would couple two independently deployable
 * units at build time for no gain: the page revalidates within a minute of the
 * API coming up, so an empty first render costs nothing.
 */
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
    <main className="container-wide">
      <section className="hero">
        <h1>Handcrafted Fine Jewelry & Timeless Luxury</h1>
        <p>
          Exquisite diamond rings, Rivière necklaces, cultured pearls, and solid gold essentials.
          Every piece is master-crafted, ethically sourced, and guaranteed in real-time inventory.
        </p>
        <div className="row" style={{ marginTop: 24 }}>
          <Link href="/products" className="btn btn-primary">
            Explore the Collection
          </Link>
        </div>
      </section>

      <div className="row between" style={{ marginBottom: 16 }}>
        <h2>Latest</h2>
        <div className="row">
          {categories.map((category) => (
            <Link key={category.id} href={`/products?category=${category.slug}`} className="badge">
              {category.name}
            </Link>
          ))}
        </div>
      </div>

      {featured.items.length === 0 ? (
        <p className="empty">No products yet</p>
      ) : (
        <div className="products">
          {featured.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
