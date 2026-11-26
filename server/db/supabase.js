import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const PLACEHOLDER = 'https://placeholder.supabase.co';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase environment variables not set. Database calls will fail.');
}

export const supabaseAdmin = createClient(supabaseUrl || PLACEHOLDER, supabaseServiceKey || 'placeholder', {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const supabaseAnon = createClient(supabaseUrl || PLACEHOLDER, supabaseAnonKey || 'placeholder');

/**
 * A throwaway client for signing someone in with a password.
 *
 * Never call signInWithPassword (or any other session-setting auth call) on
 * supabaseAdmin: supabase-js keeps the resulting session in memory and sends
 * that person's token on every later admin query, so the "admin" client would
 * quietly run as whoever signed in last (and be blocked by row-level security).
 * On Netlify a warm function instance is shared across requests, so this would
 * leak between users. Make a fresh client per sign-in instead.
 */
export function supabaseSignInClient() {
  return createClient(supabaseUrl || PLACEHOLDER, supabaseAnonKey || 'placeholder', {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function supabaseForUser(accessToken) {
  return createClient(supabaseUrl || PLACEHOLDER, supabaseAnonKey || 'placeholder', {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
