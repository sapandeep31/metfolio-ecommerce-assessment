import { loginSchema, type Role } from '@shop/shared';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { API_BASE_URL } from './lib/config';
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

const nextAuthInstance = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        if (!response.ok) return null;
        return (await response.json()) as {
          id: string;
          email: string;
          name: string | null;
          role: Role;
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});

export const { handlers, signIn: nextAuthSignIn, signOut: nextAuthSignOut } = nextAuthInstance;

/**
 * Server-side session accessor:
 * Checks Supabase Auth first (when configured with a live instance),
 * then falls back to NextAuth (for local development, CI test suites, and seeded accounts).
 */
export async function auth(): Promise<Session | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.includes('your-project')) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
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
      }
    } catch {
      // Fall through to NextAuth
    }
  }

  try {
    const session = await nextAuthInstance.auth();
    if (session?.user) {
      return {
        user: {
          id: (session.user as { id?: string }).id ?? '',
          email: session.user.email ?? '',
          role: ((session.user as { role?: Role }).role as Role) ?? 'CUSTOMER',
          name: session.user.name ?? null,
        },
      };
    }
  } catch {
    return null;
  }

  return null;
}
