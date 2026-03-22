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

export function supabaseForUser(accessToken) {
  return createClient(supabaseUrl || PLACEHOLDER, supabaseAnonKey || 'placeholder', {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
