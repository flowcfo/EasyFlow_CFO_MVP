import { supabaseAdmin } from '../../db/supabase.js';
import { createOAuthNonce } from '../oauthNonce.js';

const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';
const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';

export async function getAuthorizationUrl(userId) {
  const state = await createOAuthNonce(userId, 'zoho');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ZOHO_CLIENT_ID,
    scope: 'ZohoBooks.fullaccess.READ',
    redirect_uri: process.env.ZOHO_REDIRECT_URI,
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${ZOHO_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code, userId) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri: process.env.ZOHO_REDIRECT_URI,
    code,
  });

  const response = await fetch(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  // Get organization ID
  const orgResponse = await fetch('https://books.zoho.com/api/v3/organizations', {
    headers: { Authorization: `Zoho-oauthtoken ${data.access_token}` },
  });
  const orgData = await orgResponse.json();
  const organizationId = orgData.organizations?.[0]?.organization_id || '';

  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  await supabaseAdmin.from('integrations').upsert({
    user_id: userId,
    provider: 'zoho',
    realm_id: organizationId,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: expiresAt.toISOString(),
    pull_status: 'pending',
  }, { onConflict: 'user_id,provider' });

  return { access_token: data.access_token, organization_id: organizationId };
}

export async function refreshAccessToken(userId) {
  const { data: integration, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'zoho')
    .single();

  if (error || !integration) throw new Error('Zoho integration not found');

  if (new Date(integration.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return integration.access_token;
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: integration.refresh_token,
  });

  const response = await fetch(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  await supabaseAdmin
    .from('integrations')
    .update({
      access_token: data.access_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'zoho');

  return data.access_token;
}

export async function revokeTokens(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('refresh_token')
    .eq('user_id', userId)
    .eq('provider', 'zoho')
    .single();

  if (integration?.refresh_token) {
    try {
      await fetch(`https://accounts.zoho.com/oauth/v2/token/revoke?token=${integration.refresh_token}`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Zoho token revocation failed:', err.message);
    }
  }

  await supabaseAdmin
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'zoho');
}
