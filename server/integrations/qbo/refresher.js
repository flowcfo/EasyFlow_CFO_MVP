import OAuthClient from 'intuit-oauth';
import { supabaseAdmin } from '../../db/supabase.js';

export async function ensureFreshToken(userId) {
  const { data: integration, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'qbo')
    .single();

  if (error || !integration) {
    throw new Error('No QBO integration found. Please connect QuickBooks first.');
  }

  const expiresAt = new Date(integration.token_expires_at);
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinFromNow) {
    return integration;
  }

  const oauthClient = new OAuthClient({
    clientId: process.env.INTUIT_CLIENT_ID,
    clientSecret: process.env.INTUIT_CLIENT_SECRET,
    environment: process.env.INTUIT_ENVIRONMENT || 'sandbox',
    redirectUri: process.env.INTUIT_REDIRECT_URI,
  });

  oauthClient.setToken({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    token_type: 'bearer',
  });

  try {
    const authResponse = await oauthClient.refresh();
    const token = authResponse.getJson();
    const newExpiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const { data: updated } = await supabaseAdmin
      .from('integrations')
      .update({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expires_at: newExpiresAt,
      })
      .eq('id', integration.id)
      .select()
      .single();

    return updated;
  } catch (err) {
    await supabaseAdmin
      .from('integrations')
      .update({ pull_status: 'failed' })
      .eq('id', integration.id);

    throw new Error(`QBO token refresh failed: ${err.message}. Please reconnect QuickBooks.`);
  }
}
