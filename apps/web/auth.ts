import type { Role } from '@shop/shared';
import { NextResponse } from 'next/server';
import { createClient } from './lib/supabase/server';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
}

export interface Session {
  user: SessionUser;
}

/**
 * Server-side session accessor backed by Supabase Auth and public.profiles.
 */
export async function auth(): Promise<Session | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    let role: Role = user.app_metadata?.role === 'admin' ? 'ADMIN' : 'CUSTOMER';
    if (role !== 'ADMIN') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role === 'admin') role = 'ADMIN';
    }

    return {
      user: {
        id: user.id,
        email: user.email ?? '',
        role,
        name:
          (user.user_metadata?.display_name as string) ||
          (user.user_metadata?.name as string) ||
          user.email ||
          null,
      },
    };
  } catch {
    return null;
  }
}

export const handlers = {
  GET: async () => NextResponse.json({ ok: true }),
  POST: async () => NextResponse.json({ ok: true }),
};
