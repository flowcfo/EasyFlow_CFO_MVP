/**
 * Xero OAuth 2.0 Integration
 * Uses Xero's standard OAuth 2.0 flow with PKCE
 * Scopes: openid profile email accounting.reports.read
 */

import { supabaseAdmin } from '../../db/supabase.js';

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';

export function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.XERO_CLIENT_ID,
    redirect_uri: process.env.XERO_REDIRECT_URI,
    scope: 'openid profile email accounting.reports.read offline_access',
    state,
  });
  return `${XERO_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(code, userId) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.XERO_REDIRECT_URI,
    client_id: process.env.XERO_CLIENT_ID,
    client_secret: process.env.XERO_CLIENT_SECRET,
  });

  const resp = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`Xero token exchange failed: ${resp.status}`);
  const token = await resp.json();

  const connectionsResp = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const connections = await connectionsResp.json();
  const tenantId = connections?.[0]?.tenantId || '';

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .upsert({
      user_id: userId,
      provider: 'xero',
      realm_id: tenantId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: expiresAt,
      pull_status: 'pending',
    }, { onConflict: 'user_id,provider' })
    .select()
    .single();

  if (error) throw new Error(`Failed to store Xero tokens: ${error.message}`);
  return data;
}

export async function refreshToken(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'xero')
    .single();

  if (!integration?.refresh_token) throw new Error('No Xero refresh token found');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
    client_id: process.env.XERO_CLIENT_ID,
    client_secret: process.env.XERO_CLIENT_SECRET,
  });

  const resp = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`Xero token refresh failed: ${resp.status}`);
  const token = await resp.json();

  await supabaseAdmin
    .from('integrations')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'xero');

  return token.access_token;
}

export async function ensureFreshToken(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('access_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'xero')
    .single();

  if (!integration) throw new Error('Xero not connected');

  const bufferMs = 5 * 60 * 1000;
  if (new Date(integration.token_expires_at).getTime() - bufferMs < Date.now()) {
    return refreshToken(userId);
  }
  return integration.access_token;
}

export async function revokeTokens(userId) {
  await supabaseAdmin
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'xero');
}

export async function getIntegrationStatus(userId) {
  const { data } = await supabaseAdmin
    .from('integrations')
    .select('provider, realm_id, token_expires_at, last_pulled_at, pull_status')
    .eq('user_id', userId)
    .eq('provider', 'xero')
    .single();

  if (!data) return { connected: false, provider: 'xero' };
  return {
    connected: true,
    provider: 'xero',
    realm_id: data.realm_id,
    last_pulled_at: data.last_pulled_at,
    pull_status: data.pull_status,
    token_expired: new Date(data.token_expires_at) < new Date(),
  };
}
