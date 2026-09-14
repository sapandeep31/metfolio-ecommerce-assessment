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
 *
 * The trade is a brief render with no cart count on first paint. That is worth
 * far less than statically served catalog pages.
 */
export function Nav() {
  const [state, setState] = useState<NavState | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/nav-state', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: NavState | null) => {
        if (!cancelled && body) setState(body);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const count = state?.cartCount ?? 0;

  return (
    <nav className="nav" aria-label="Primary">
      <Link href="/" className="brand">
        Shop
      </Link>
      <div className="links">
        <Link href="/products">Catalog</Link>
        {state?.isAdmin && <Link href="/admin">Admin</Link>}
        {state?.signedIn ? (
          <>
            <Link href="/orders">Orders</Link>
            <form action={signoutAction} style={{ display: 'inline' }}>
              <button
                type="submit"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.9rem',
                }}
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login">Sign in</Link>
        )}
        <Link href="/cart" data-testid="cart-link">
          Cart
          <span data-testid="cart-count" className="cart-count">
            {count > 0 ? ` (${count})` : ''}
          </span>
          {count > 0 && (
            <span className="sr-only">{count === 1 ? '1 item' : `${count} items`}</span>
          )}
        </Link>
      </div>
    </nav>
  );
}
