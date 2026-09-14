'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { signoutAction } from '../app/auth-actions';

interface NavState {
  signedIn: boolean;
  isAdmin: boolean;
  userEmail?: string | null;
  cartCount: number;
}

/**
 * The nav is a client component on purpose.
 *
 * Reading the session or the cart cookie in the root layout would force dynamic
 * rendering of every page in the app, which would quietly cancel the ISR on the
 * home and product pages. Fetching that state from /api/nav-state keeps the
 * layout static and confines the dynamic read to one route handler.
 */
export function Nav() {
  const [state, setState] = useState<NavState | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const refreshNavState = () => {
      fetch('/api/nav-state', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: NavState | null) => {
          if (!cancelled && body) setState(body);
        })
        .catch(() => undefined);
    };

    refreshNavState();
    window.addEventListener('cart-updated', refreshNavState);

    return () => {
      cancelled = true;
      window.removeEventListener('cart-updated', refreshNavState);
    };
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      // Transition from transparent to colored only when scrolling out of the hero section
      const heroThreshold = Math.max(window.innerHeight - 120, 400);
      setIsScrolled(window.scrollY > heroThreshold);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const isHome = pathname === '/';
  const isTransparent = isHome && !isScrolled;
  const count = state?.cartCount ?? 0;

  return (
    <header
      className={`nav-wrapper ${isHome ? 'nav-wrapper-home' : ''} ${
        isTransparent ? 'nav-transparent' : 'nav-scrolled'
      }`}
    >
      <nav className="nav nav-luxury" aria-label="Primary">
        <Link href="/" className="brand brand-luxury">
          <span className="brand-crest" aria-hidden="true">⚜</span>
          <span className="brand-text">
            <span className="brand-name">METFOLIO</span>
            <span className="brand-sub">ATELIER · HAUTE JOAILLERIE</span>
          </span>
        </Link>

        <div className="nav-center-links">
          <Link href="/products" className={pathname === '/products' ? 'active' : ''}>
            Catalog
          </Link>
          <Link href="/products?category=necklaces">Necklaces</Link>
          <Link href="/products?category=rings">Rings</Link>
          <Link href="/products?category=earrings">Earrings</Link>
          <Link href="/products?category=bracelets">Bracelets</Link>
        </div>

        <div className="links nav-actions">
          {state?.isAdmin && (
            <Link href="/admin" className="admin-link-pill">
              Admin
            </Link>
          )}

          {state?.signedIn ? (
            <>
              <Link href="/orders" className="orders-link">
                Orders
              </Link>
              <form action={signoutAction} style={{ display: 'inline' }}>
                <button
                  type="submit"
                  className="nav-action-btn"
                  title="Sign out of your atelier account"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="login-link">
              Sign in
            </Link>
          )}

          <Link href="/cart" data-testid="cart-link" className="cart-badge-link">
            <span className="cart-icon" aria-hidden="true">✦</span>
            <span className="cart-label">Bag</span>
            <span data-testid="cart-count" className="cart-count">
              {count > 0 ? ` (${count})` : ''}
            </span>
            {count > 0 && (
              <span className="sr-only">{count === 1 ? '1 item' : `${count} items`}</span>
            )}
          </Link>
        </div>
      </nav>
    </header>
  );
}
