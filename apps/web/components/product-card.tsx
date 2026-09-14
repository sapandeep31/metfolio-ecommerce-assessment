import { formatMoney, type Product } from '@shop/shared';
import Link from 'next/link';

/** Total available stock across a product's variants. */
export function totalAvailable(product: Product): number {
  return product.variants.reduce((sum, variant) => sum + variant.availableStock, 0);
}

/**
 * A product, as an editorial photograph with noble metal details.
 *
 * The thumb holds a fixed 4:5 ratio, so a slow image never reflows the grid
 * under a shopper's cursor.
 */
export function ProductCard({
  product,
  showStock = false,
}: {
  product: Product;
  showStock?: boolean;
}) {
  const available = totalAvailable(product);
  const image = product.images[0];
  const primaryVariant = product.variants[0];

  return (
    <article className="card product-card luxury-product-card" data-testid="product-card" data-slug={product.slug}>
      <Link href={`/products/${product.slug}`}>
        <div className="product-thumb">
          {image ? (
            <img src={image.url} alt={image.alt || product.title} loading="lazy" />
          ) : (
            <span className="placeholder" aria-hidden="true">
              {product.title.slice(0, 2)}
            </span>
          )}
          <span className="product-card-tag">
            {primaryVariant?.name.split('/')[0]?.trim() ?? product.category?.name ?? 'Atelier'}
          </span>
        </div>
        <div className="product-body">
          <div className="product-card-topline">
            <span className="product-meta">{product.category?.name ?? 'Uncategorised'}</span>
            <span className="price">{formatMoney(product.fromPriceCents)}</span>
          </div>
          <h3>{product.title}</h3>
          {showStock && (
            <span className="product-meta product-stock-pill" data-testid="availability">
              {available > 0 ? `${available} in stock` : 'Sold out'}
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
