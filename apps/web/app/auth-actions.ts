'use server';

import { signupSchema } from '@shop/shared';
import { redirect } from 'next/navigation';
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message || 'Invalid email or password.' };
  }

  // If user is trying to access /admin, verify admin role
  if (next.startsWith('/admin')) {
    let role = data.user?.app_metadata?.role;
    if (!role && data.user) {
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

  // If session is immediately established (auto-confirm enabled)
  if (data.session) {
    redirect('/');
  }

  return { success: 'Account created! Please check your email to confirm or sign in.' };
}

export async function signoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function resetPasswordAction(
  _state: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Please enter your email address.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    return { error: error.message };
  }
  return { success: 'Password reset link sent! Check your email inbox.' };
}
