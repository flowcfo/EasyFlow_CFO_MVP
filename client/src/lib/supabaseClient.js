import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surface this loudly during dev so the auth screens are not mysterious 500s.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Password reset, set-password, and onboarding-flag updates will fail.',
  );
}

/**
 * Browser Supabase client.
 *
 * Used only for:
 *   1. Password reset request    (resetPasswordForEmail)
 *   2. Password update on reset/set-password screens (updateUser)
 *   3. Updating users.has_completed_onboarding from WelcomeCard (RLS allows owner row updates)
 *
 * Day-to-day login still goes through our Express /auth/login. After a password is set/reset,
 * we copy the Supabase session tokens into localStorage under the same keys our existing
 * AuthContext reads, then hard-redirect so AuthContext re-fetches /auth/me with the new JWT.
 *
 * detectSessionInUrl: true (default) lets Supabase parse #access_token=... fragments on the
 * /reset-password and /set-password routes that arrive from the email link.
 */
export const supabase = createClient(url || 'http://localhost', anonKey || 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/**
 * After a password set/reset, mirror the Supabase session into the localStorage keys our
 * AuthContext reads. A hard reload then re-hydrates AuthContext from /auth/me.
 */
export function syncSupabaseSessionToLocalStorage(session) {
  if (!session?.access_token || !session?.refresh_token) return;
  localStorage.setItem('access_token', session.access_token);
  localStorage.setItem('refresh_token', session.refresh_token);
}
