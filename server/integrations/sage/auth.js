/**
 * Sage Business Cloud Accounting OAuth 2.0 Integration
 * https://developer.sage.com/accounting/guides/authenticating/
 */

import { supabaseAdmin } from '../../db/supabase.js';

const SAGE_AUTH_URL = 'https://www.sageone.com/oauth2/auth/central?filter=apiv3.1';
const SAGE_TOKEN_URL = 'https://oauth.accounting.sage.com/token';

export function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SAGE_CLIENT_ID,
    redirect_uri: process.env.SAGE_REDIRECT_URI,
    scope: 'full_access',
    state,
  });
  return `${SAGE_AUTH_URL}&${params.toString()}`;
}

export async function handleCallback(code, userId) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.SAGE_CLIENT_ID,
    client_secret: process.env.SAGE_CLIENT_SECRET,
    redirect_uri: process.env.SAGE_REDIRECT_URI,
  });

  const resp = await fetch(SAGE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`Sage token exchange failed: ${resp.status}`);
  const token = await resp.json();

  const bizResp = await fetch('https://api.accounting.sage.com/v3.1/business', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const bizData = await bizResp.json();
  const businessId = bizData?.id || '';

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .upsert({
      user_id: userId,
      provider: 'sage',
      realm_id: businessId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: expiresAt,
      pull_status: 'pending',
    }, { onConflict: 'user_id,provider' })
    .select()
    .single();

  if (error) throw new Error(`Failed to store Sage tokens: ${error.message}`);
  return data;
}

export async function refreshToken(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'sage')
    .single();

  if (!integration?.refresh_token) throw new Error('No Sage refresh token');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
    client_id: process.env.SAGE_CLIENT_ID,
    client_secret: process.env.SAGE_CLIENT_SECRET,
  });

  const resp = await fetch(SAGE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`Sage token refresh failed: ${resp.status}`);
  const token = await resp.json();

  await supabaseAdmin
    .from('integrations')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'sage');

  return token.access_token;
}

export async function ensureFreshToken(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('access_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'sage')
    .single();

  if (!integration) throw new Error('Sage not connected');
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
    .eq('provider', 'sage');
}

export async function getIntegrationStatus(userId) {
  const { data } = await supabaseAdmin
    .from('integrations')
    .select('provider, realm_id, token_expires_at, last_pulled_at, pull_status')
    .eq('user_id', userId)
    .eq('provider', 'sage')
    .single();

  if (!data) return { connected: false, provider: 'sage' };
  return {
    connected: true,
    provider: 'sage',
    realm_id: data.realm_id,
    last_pulled_at: data.last_pulled_at,
    pull_status: data.pull_status,
    token_expired: new Date(data.token_expires_at) < new Date(),
  };
}
