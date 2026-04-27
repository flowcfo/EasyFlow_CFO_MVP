/**
 * Wave Accounting OAuth 2.0 Integration
 * https://developer.waveapps.com/hc/en-us/articles/360019762711
 * Wave uses GraphQL API with OAuth 2.0 bearer tokens
 */

import { supabaseAdmin } from '../../db/supabase.js';
import { createOAuthNonce } from '../oauthNonce.js';

const WAVE_AUTH_URL = 'https://api.waveapps.com/oauth2/authorize/';
const WAVE_TOKEN_URL = 'https://api.waveapps.com/oauth2/token/';

export async function getAuthorizationUrl(userId) {
  const state = await createOAuthNonce(userId, 'wave');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WAVE_CLIENT_ID,
    redirect_uri: process.env.WAVE_REDIRECT_URI,
    scope: 'account:read',
    state,
  });
  return `${WAVE_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(code, userId) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.WAVE_CLIENT_ID,
    client_secret: process.env.WAVE_CLIENT_SECRET,
    redirect_uri: process.env.WAVE_REDIRECT_URI,
  });

  const resp = await fetch(WAVE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`Wave token exchange failed: ${resp.status}`);
  const token = await resp.json();

  const bizResp = await fetch('https://gql.waveapps.com/graphql/public', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: '{ businesses { edges { node { id name } } } }' }),
  });
  const bizData = await bizResp.json();
  const businessId = bizData?.data?.businesses?.edges?.[0]?.node?.id || '';

  const expiresAt = new Date(Date.now() + (token.expires_in || 31536000) * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .upsert({
      user_id: userId,
      provider: 'wave',
      realm_id: businessId,
      access_token: token.access_token,
      refresh_token: token.refresh_token || '',
      token_expires_at: expiresAt,
      pull_status: 'pending',
    }, { onConflict: 'user_id,provider' })
    .select()
    .single();

  if (error) throw new Error(`Failed to store Wave tokens: ${error.message}`);
  return data;
}

export async function refreshToken(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'wave')
    .single();

  if (!integration?.refresh_token) throw new Error('No Wave refresh token');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
    client_id: process.env.WAVE_CLIENT_ID,
    client_secret: process.env.WAVE_CLIENT_SECRET,
  });

  const resp = await fetch(WAVE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`Wave token refresh failed: ${resp.status}`);
  const token = await resp.json();

  await supabaseAdmin
    .from('integrations')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token || integration.refresh_token,
      token_expires_at: new Date(Date.now() + (token.expires_in || 31536000) * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'wave');

  return token.access_token;
}

export async function ensureFreshToken(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('access_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'wave')
    .single();

  if (!integration) throw new Error('Wave not connected');
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
    .eq('provider', 'wave');
}

export async function getIntegrationStatus(userId) {
  const { data } = await supabaseAdmin
    .from('integrations')
    .select('provider, realm_id, token_expires_at, last_pulled_at, pull_status')
    .eq('user_id', userId)
    .eq('provider', 'wave')
    .single();

  if (!data) return { connected: false, provider: 'wave' };
  return {
    connected: true,
    provider: 'wave',
    realm_id: data.realm_id,
    last_pulled_at: data.last_pulled_at,
    pull_status: data.pull_status,
    token_expired: new Date(data.token_expires_at) < new Date(),
  };
}
