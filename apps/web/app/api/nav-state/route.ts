import type { Cart } from '@shop/shared';
import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { cartApiFetch, getCartId } from '../../../lib/api';

/**
 * Everything the nav needs, in one request.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const user = session?.user;
  const isAdmin = user?.role === 'ADMIN';

  let cartCount = 0;
  const cartId = await getCartId(false);
  if (cartId) {
    try {
      const cart = await cartApiFetch<Cart>(cartId, '/cart');
      cartCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
    } catch {
      // A cart the API cannot serve reads as empty
    }
  }

  return NextResponse.json({
    signedIn: Boolean(user),
    isAdmin: Boolean(isAdmin),
    userEmail: user?.email ?? null,
    cartCount,
  });
}
