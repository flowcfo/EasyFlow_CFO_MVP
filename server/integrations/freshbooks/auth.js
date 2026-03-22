/**
 * FreshBooks OAuth 2.0 Integration
 * https://www.freshbooks.com/api/authentication
 */

import { supabaseAdmin } from '../../db/supabase.js';

const FB_AUTH_URL = 'https://auth.freshbooks.com/oauth/authorize';
const FB_TOKEN_URL = 'https://api.freshbooks.com/auth/oauth/token';

export function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.FRESHBOOKS_CLIENT_ID,
    redirect_uri: process.env.FRESHBOOKS_REDIRECT_URI,
    state,
  });
  return `${FB_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(code, userId) {
  const resp = await fetch(FB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.FRESHBOOKS_CLIENT_ID,
      client_secret: process.env.FRESHBOOKS_CLIENT_SECRET,
      redirect_uri: process.env.FRESHBOOKS_REDIRECT_URI,
    }),
  });

  if (!resp.ok) throw new Error(`FreshBooks token exchange failed: ${resp.status}`);
  const token = await resp.json();

  const meResp = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = await meResp.json();
  const accountId = me?.response?.business_memberships?.[0]?.business?.account_id || '';

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .upsert({
      user_id: userId,
      provider: 'freshbooks',
      realm_id: accountId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: expiresAt,
      pull_status: 'pending',
    }, { onConflict: 'user_id,provider' })
    .select()
    .single();

  if (error) throw new Error(`Failed to store FreshBooks tokens: ${error.message}`);
  return data;
}

export async function refreshToken(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'freshbooks')
    .single();

  if (!integration?.refresh_token) throw new Error('No FreshBooks refresh token');

  const resp = await fetch(FB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
      client_id: process.env.FRESHBOOKS_CLIENT_ID,
      client_secret: process.env.FRESHBOOKS_CLIENT_SECRET,
    }),
  });

  if (!resp.ok) throw new Error(`FreshBooks token refresh failed: ${resp.status}`);
  const token = await resp.json();

  await supabaseAdmin
    .from('integrations')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'freshbooks');

  return token.access_token;
}

export async function ensureFreshToken(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('access_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'freshbooks')
    .single();

  if (!integration) throw new Error('FreshBooks not connected');
  if (new Date(integration.token_expires_at).getTime() - 300000 < Date.now()) {
    return refreshToken(userId);
  }
  return integration.access_token;
}

export async function revokeTokens(userId) {
  await supabaseAdmin
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'freshbooks');
}

export async function getIntegrationStatus(userId) {
  const { data } = await supabaseAdmin
    .from('integrations')
    .select('provider, realm_id, token_expires_at, last_pulled_at, pull_status')
    .eq('user_id', userId)
    .eq('provider', 'freshbooks')
    .single();

  if (!data) return { connected: false, provider: 'freshbooks' };
  return {
    connected: true,
    provider: 'freshbooks',
    realm_id: data.realm_id,
    last_pulled_at: data.last_pulled_at,
    pull_status: data.pull_status,
    token_expired: new Date(data.token_expires_at) < new Date(),
  };
}
