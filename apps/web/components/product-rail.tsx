'use client';

import { formatMoney, type Product } from '@shop/shared';
import Link from 'next/link';

const ARCHIVAL_FALLBACK_SPECIMENS: Product[] = [
  {
    id: 'specimen-1',
    slug: 'diamond-tennis-necklace',
    title: 'Rivière Diamond Tennis Necklace',
    description: 'Graduated rivière necklace featuring 12 carats of ethically sourced round diamonds.',
    status: 'ACTIVE',
    category: { id: 'c-necklaces', slug: 'necklaces', name: 'Necklaces' },
    images: [{ id: 'img-1', url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80', alt: 'Rivière Diamond Tennis Necklace', position: 0 }],
    variants: [{ id: 'v-1', sku: 'NCK-TEN-16', name: '16-inch / 18k White Gold', priceCents: 420000, availableStock: 8, position: 0 }],
    fromPriceCents: 420000,
  },
  {
    id: 'specimen-2',
    slug: 'solitaire-diamond-ring',
    title: 'Round Brilliant Solitaire Ring',
    description: '1.5-carat round brilliant diamond in four-prong cathedral setting.',
    status: 'ACTIVE',
    category: { id: 'c-rings', slug: 'rings', name: 'Rings' },
    images: [{ id: 'img-2', url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80', alt: 'Round Brilliant Solitaire Ring', position: 0 }],
    variants: [{ id: 'v-2', sku: 'RING-SOL-15CT', name: 'Platinum / Size 6', priceCents: 245000, availableStock: 12, position: 0 }],
    fromPriceCents: 245000,
  },
  {
    id: 'specimen-3',
    slug: 'eternity-diamond-band',
    title: 'Eternity Diamond Band',
    description: 'Continuous circle of pavé-set round brilliant diamonds totaling 2.0 carats.',
    status: 'ACTIVE',
    category: { id: 'c-rings', slug: 'rings', name: 'Rings' },
    images: [{ id: 'img-3', url: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80', alt: 'Eternity Diamond Band', position: 0 }],
    variants: [{ id: 'v-3', sku: 'RING-ETR-WG-6', name: '18k White Gold', priceCents: 175000, availableStock: 14, position: 0 }],
    fromPriceCents: 175000,
  },
  {
    id: 'specimen-4',
    slug: 'diamond-tennis-bracelet',
    title: 'Classic Diamond Tennis Bracelet',
    description: 'Articulated line of matched round brilliant diamonds totaling 5.0 carats in 18k white gold.',
    status: 'ACTIVE',
    category: { id: 'c-bracelets', slug: 'bracelets', name: 'Bracelets' },
    images: [{ id: 'img-4', url: 'https://images.unsplash.com/photo-1611591475822-a9b0c79f3ec6?auto=format&fit=crop&w=800&q=80', alt: 'Classic Diamond Tennis Bracelet', position: 0 }],
    variants: [{ id: 'v-4', sku: 'BRC-TEN-7', name: '7-inch / 18k White Gold', priceCents: 310000, availableStock: 10, position: 0 }],
    fromPriceCents: 310000,
  },
  {
    id: 'specimen-5',
    slug: 'emerald-cut-pendant',
    title: 'Emerald Cut Diamond Pendant',
    description: 'A striking 1.2-carat emerald-cut diamond suspended from a delicate 18k gold cable chain.',
    status: 'ACTIVE',
    category: { id: 'c-necklaces', slug: 'necklaces', name: 'Necklaces' },
    images: [{ id: 'img-5', url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80', alt: 'Emerald Cut Diamond Pendant', position: 0 }],
    variants: [{ id: 'v-5', sku: 'NCK-EM-YG', name: '18k Yellow Gold / 1.2ct', priceCents: 189000, availableStock: 25, position: 0 }],
    fromPriceCents: 189000,
  },
  {
    id: 'specimen-6',
    slug: 'diamond-solitaire-studs',
    title: 'Diamond Solitaire Stud Earrings',
    description: 'Classic matching pair of round brilliant diamonds set in minimalist three-prong martini mounts.',
    status: 'ACTIVE',
    category: { id: 'c-earrings', slug: 'earrings', name: 'Earrings' },
    images: [{ id: 'img-6', url: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800&q=80', alt: 'Diamond Solitaire Stud Earrings', position: 0 }],
    variants: [{ id: 'v-6', sku: 'EAR-SOL-1CT', name: '1.0 Total Carat Weight', priceCents: 110000, availableStock: 30, position: 0 }],
    fromPriceCents: 110000,
  },
  {
    id: 'specimen-7',
    slug: 'akoya-pearl-strand',
    title: 'Akoya Cultured Pearl Strand',
    description: 'Luminous 7.5-8.0mm Japanese Akoya cultured pearls hand-knotted on pure silk.',
    status: 'ACTIVE',
    category: { id: 'c-necklaces', slug: 'necklaces', name: 'Necklaces' },
    images: [{ id: 'img-7', url: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=800&q=80', alt: 'Akoya Cultured Pearl Strand', position: 0 }],
    variants: [{ id: 'v-7', sku: 'NCK-PRL-18', name: '18-inch Princess Length', priceCents: 125000, availableStock: 22, position: 0 }],
    fromPriceCents: 125000,
  },
  {
    id: 'specimen-8',
    slug: 'pave-diamond-huggie-hoops',
    title: 'Pavé Diamond Huggie Hoops',
    description: 'Petite 12mm huggie hoops encrusted with micro-pavé diamonds along the outer curve.',
    status: 'ACTIVE',
    category: { id: 'c-earrings', slug: 'earrings', name: 'Earrings' },
    images: [{ id: 'img-8', url: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=800&q=80', alt: 'Pavé Diamond Huggie Hoops', position: 0 }],
    variants: [{ id: 'v-8', sku: 'EAR-HUG-YG', name: '14k Yellow Gold', priceCents: 65000, availableStock: 40, position: 0 }],
    fromPriceCents: 65000,
  },
];

export function ProductRail({
  products,
  title = 'The Atelier Vault Collection',
  subtitle = 'Master-crafted solitary diamonds, pavé bands, and graduated rivières available for acquisition.',
}: {
  products: Product[];
  title?: string;
  subtitle?: string;
}) {
  const hasRealProducts = Boolean(products && products.length > 0);
  // Fallback to curated specimens if empty catalog or offline fallback
  const activeProducts = hasRealProducts ? products : ARCHIVAL_FALLBACK_SPECIMENS;

  // Duplicate items for a seamless, continuous infinite marquee loop
  const duplicatedItems = [...activeProducts, ...activeProducts];

  return (
    <section id="collection-rail" className="product-rail-section" aria-label="Atelier Vault Collection">
      <div className="container-wide">
        <div className="product-rail-header">
          <span className="product-rail-eyebrow">
            <span className="vault-eyebrow-crest">✦</span> ATELIER HAUTE JOAILLERIE · ARCHIVAL VAULT <span className="vault-eyebrow-crest">✦</span>
          </span>
          <h2 className="product-rail-title">{title}</h2>
          <p className="product-rail-subtitle">{subtitle}</p>
        </div>
      </div>

      {/* Edge-vignetted Marquee Viewport */}
      <div
        className="product-rail-marquee-viewport"
        role="region"
        aria-label="Infinite product showcase, hover to pause"
      >
        <div className="product-rail-marquee-track">
          {duplicatedItems.map((product, index) => {
            const image = product.images[0];
            const primaryVariant = product.variants[0];

            return (
              <article
                key={`${product.id}-cycle-${index}`}
                className="luxury-rail-card"
                {...(hasRealProducts ? { 'data-testid': 'product-card', 'data-slug': product.slug } : {})}
              >
                <Link href={`/products/${product.slug}`} className="rail-card-link">
                  {/* Clean Card Media */}
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

                    {/* Subtle Shimmer Light Reflection */}
                    <div className="rail-card-shimmer" aria-hidden="true" />
                  </div>

                  {/* Card Body */}
                  <div className="rail-card-body">
                    <div className="rail-card-meta-row">
                      <span className="rail-card-sku">
                        {primaryVariant?.sku ? `ARCHIVE // ${primaryVariant.sku}` : 'HAUTE JOAILLERIE'}
                      </span>
                      <span className="rail-card-status-dot">
                        <span className="status-live-dot" /> In Vault
                      </span>
                    </div>

                    <h3 className="rail-card-title">{product.title}</h3>

                    <div className="rail-card-pricing">
                      <div className="rail-card-price-group">
                        <span className="rail-card-from-label">Acquisition from</span>
                        <span className="rail-card-price">
                          {formatMoney(product.fromPriceCents)}
                        </span>
                      </div>
                      <span className="rail-card-craft-pill">
                        18k Gold · Fine Diamonds
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
