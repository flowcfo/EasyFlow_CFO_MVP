import OAuthClient from 'intuit-oauth';
import { supabaseAdmin } from '../../db/supabase.js';

let oauthClient = null;

function getOAuthClient() {
  if (!oauthClient) {
    oauthClient = new OAuthClient({
      clientId: process.env.INTUIT_CLIENT_ID,
      clientSecret: process.env.INTUIT_CLIENT_SECRET,
      environment: process.env.INTUIT_ENVIRONMENT || 'sandbox',
      redirectUri: process.env.INTUIT_REDIRECT_URI,
    });
  }
  return oauthClient;
}

export function getAuthorizationUrl(state) {
  const client = getOAuthClient();
  return client.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state,
  });
}

export async function handleCallback(url, userId) {
  const client = getOAuthClient();
  const authResponse = await client.createToken(url);
  const token = authResponse.getJson();

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .upsert({
      user_id: userId,
      provider: 'qbo',
      realm_id: token.realmId || authResponse.token.realmId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: expiresAt,
      pull_status: 'pending',
    }, { onConflict: 'user_id,provider' })
    .select()
    .single();

  if (error) throw new Error(`Failed to store QBO tokens: ${error.message}`);
  return data;
}

export async function revokeTokens(userId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'qbo')
    .single();

  if (integration?.access_token) {
    try {
      const client = getOAuthClient();
      client.setToken({ access_token: integration.access_token });
      await client.revoke({ access_token: integration.access_token });
    } catch (err) {
      console.warn('Token revocation failed (may already be expired):', err.message);
    }
  }

  await supabaseAdmin
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'qbo');
}

export async function getIntegrationStatus(userId) {
  const { data } = await supabaseAdmin
    .from('integrations')
    .select('provider, realm_id, token_expires_at, last_pulled_at, pull_status')
    .eq('user_id', userId)
    .eq('provider', 'qbo')
    .single();

  if (!data) return { connected: false };

  return {
    connected: true,
    realm_id: data.realm_id,
    token_expires_at: data.token_expires_at,
    last_pulled_at: data.last_pulled_at,
    pull_status: data.pull_status,
    token_expired: new Date(data.token_expires_at) < new Date(),
  };
}
