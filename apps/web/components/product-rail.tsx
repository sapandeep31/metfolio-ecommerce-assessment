'use client';

import { formatMoney, type Product } from '@shop/shared';
import Link from 'next/link';
import { useRef } from 'react';

export function ProductRail({
  products,
  title = 'The Atelier Vault Collection',
  subtitle = 'Master-crafted solitary diamonds, pavé bands, and graduated rivières available for acquisition.',
}: {
  products: Product[];
  title?: string;
  subtitle?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -360 : 360;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <section id="collection-rail" className="product-rail-section">
      <div className="container-wide">
        <div className="product-rail-header">
          <div>
            <span className="product-rail-eyebrow">CURATED MASTERPIECES</span>
            <h2 className="product-rail-title">{title}</h2>
            <p className="product-rail-subtitle">{subtitle}</p>
          </div>
          <div className="product-rail-controls" aria-label="Rail navigation">
            <button
              type="button"
              className="rail-arrow-btn"
              onClick={() => scroll('left')}
              aria-label="Scroll left"
            >
              ←
            </button>
            <button
              type="button"
              className="rail-arrow-btn"
              onClick={() => scroll('right')}
              aria-label="Scroll right"
            >
              →
            </button>
          </div>
        </div>

        <div className="product-rail-track" ref={scrollRef}>
          {products.map((product) => {
            const image = product.images[0];
            const primaryVariant = product.variants[0];
            return (
              <article key={product.id} className="luxury-rail-card">
                <Link href={`/products/${product.slug}`} className="rail-card-link">
                  <div className="rail-card-media">
                    {image ? (
                      <img
                        src={image.url}
                        alt={image.alt || product.title}
                        loading="lazy"
                        className="rail-card-img"
                      />
                    ) : (
                      <div className="rail-card-placeholder">
                        <span>{product.title.slice(0, 2)}</span>
                      </div>
                    )}
                    <span className="rail-card-badge">
                      {product.category?.name ?? 'Atelier'}
                    </span>
                  </div>

                  <div className="rail-card-body">
                    <span className="rail-card-sku">
                      {primaryVariant ? primaryVariant.sku : 'HAUTE JOAILLERIE'}
                    </span>
                    <h3 className="rail-card-title">{product.title}</h3>
                    <div className="rail-card-pricing">
                      <span className="rail-card-price">
                        {formatMoney(product.fromPriceCents)}
                      </span>
                      <span className="rail-card-status">
                        Vault Stocked
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
