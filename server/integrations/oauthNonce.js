/**
 * OAuth CSRF nonce helpers.
 *
 * Each provider connect route generates a single-use nonce and stores
 * {nonce, user_id, provider} in oauth_nonces. The nonce is sent as `state`
 * to the provider. On callback, the nonce is consumed (looked up + deleted)
 * and the verified user_id is returned.
 *
 * This prevents OAuth CSRF: an attacker cannot link their provider account
 * to a victim by crafting a callback URL, because they would need a valid
 * unconsumed nonce that was issued for that specific victim's session.
 */

import crypto from 'crypto';
import { supabaseAdmin } from '../db/supabase.js';

const NONCE_BYTES = 16;

export async function createOAuthNonce(userId, provider) {
  if (!userId) throw new Error('createOAuthNonce: userId required');
  const nonce = crypto.randomBytes(NONCE_BYTES).toString('hex');
  const { error } = await supabaseAdmin
    .from('oauth_nonces')
    .insert({ nonce, user_id: userId, provider });
  if (error) throw new Error(`Failed to create OAuth nonce: ${error.message}`);
  return nonce;
}

export async function consumeOAuthNonce(nonce, provider) {
  if (!nonce || typeof nonce !== 'string') throw new Error('Invalid OAuth state');

  const { data, error } = await supabaseAdmin
    .from('oauth_nonces')
    .select('user_id, provider, expires_at')
    .eq('nonce', nonce)
    .single();

  if (error || !data) throw new Error('Invalid or expired OAuth state');
  if (data.provider !== provider) throw new Error('OAuth state provider mismatch');
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('oauth_nonces').delete().eq('nonce', nonce);
    throw new Error('OAuth state expired');
  }

  await supabaseAdmin.from('oauth_nonces').delete().eq('nonce', nonce);
  return data.user_id;
}
