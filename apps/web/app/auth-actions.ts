'use server';

import { signupSchema } from '@shop/shared';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { nextAuthSignIn, nextAuthSignOut } from '../auth';
import { API_BASE_URL } from '../lib/config';
import { createClient } from '../lib/supabase/server';

export interface AuthState {
  error?: string;
  success?: string;
}

/** Minimum seconds a human takes to fill the signup form. Bots submit instantly. */
const MIN_FILL_SECONDS = 2;

export async function loginAction(
  _state: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const next = String(formData.get('next') ?? '/');
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Please provide both email and password.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isSupabaseConfigured = Boolean(supabaseUrl && !supabaseUrl.includes('your-project'));

  // If Supabase is configured with a real project and not a local test seed user (@shop.local)
  if (isSupabaseConfigured && !email.endsWith('@shop.local')) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data?.user) {
        if (next.startsWith('/admin')) {
          let role = data.user?.app_metadata?.role;
          if (!role) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', data.user.id)
              .single();
            role = profile?.role;
          }
          if (role !== 'admin') {
            return { error: 'Access denied. You do not have administrator privileges.' };
          }
        }
        redirect(next.startsWith('/') ? next : '/');
      }
    } catch (err) {
      if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || 'digest' in err)) {
        throw err;
      }
      // If error, fall through to credentials fallback
    }
  }

  // NextAuth credentials fallback (used for test suite, local dev, and seeded DB accounts)
  try {
    await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: 'Invalid email or password.' };
    throw error;
  }

  redirect(next.startsWith('/') ? next : '/');
}

export async function signupAction(
  _state: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  // Honeypot: a field hidden from humans and irresistible to naive bots.
  if (String(formData.get('company') ?? '') !== '') return { error: 'Signup failed.' };
  const renderedAt = Number(formData.get('_ts') ?? 0);
  if (renderedAt && (Date.now() - renderedAt) / 1000 < MIN_FILL_SECONDS) {
    return { error: 'That was too quick. Please try again.' };
  }

  const parsed = signupSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    name: String(formData.get('name') ?? '').trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isSupabaseConfigured = Boolean(supabaseUrl && !supabaseUrl.includes('your-project'));

  if (isSupabaseConfigured) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: {
            display_name: parsed.data.name,
            name: parsed.data.name,
          },
        },
      });

      if (error) {
        return { error: error.message || 'Could not create account.' };
      }

      if (data.session) {
        redirect('/');
      }

      return { success: 'Account created! Please check your email to confirm or sign in.' };
    } catch (err) {
      if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || 'digest' in err)) {
        throw err;
      }
    }
  }

  // Fallback to internal API signup
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { error: body.message ?? 'Could not create that account.' };
  }

  try {
    await nextAuthSignIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    redirect('/login');
  }
  redirect('/');
}

export async function signoutAction(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.includes('your-project')) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
  try {
    await nextAuthSignOut({ redirect: false });
  } catch {
    // ignore
  }
  redirect('/login');
}

export async function resetPasswordAction(
  _state: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Please enter your email address.' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.includes('your-project')) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        return { error: error.message };
      }
      return { success: 'Password reset link sent! Check your email inbox.' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Could not reset password.' };
    }
  }

  return { success: 'If an account exists, a reset link will be sent.' };
}
