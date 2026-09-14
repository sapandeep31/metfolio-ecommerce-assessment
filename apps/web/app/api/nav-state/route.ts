import type { Cart } from '@shop/shared';
import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { cartApiFetch, getCartId } from '../../../lib/api';

/**
 * Everything the nav needs, in one request.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = user?.app_metadata?.role === 'admin';
  if (!isAdmin && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    isAdmin = profile?.role === 'admin';
  }

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
