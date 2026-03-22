import OAuthClient from 'intuit-oauth';
import { ensureFreshToken } from './refresher.js';
import { supabaseAdmin } from '../../db/supabase.js';

export async function pullProfitAndLoss(userId, dateRange = {}) {
  const integration = await ensureFreshToken(userId);

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

  const now = new Date();
  const startDate = dateRange.start_date || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
  const endDate = dateRange.end_date || now.toISOString().split('T')[0];

  const baseUrl = process.env.INTUIT_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

  const url = `${baseUrl}/v3/company/${integration.realm_id}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&summarize_column_by=Total`;

  try {
    const response = await oauthClient.makeApiCall({ url, method: 'GET' });
    const report = JSON.parse(response.text());

    await supabaseAdmin
      .from('integrations')
      .update({
        last_pulled_at: new Date().toISOString(),
        pull_status: 'success',
      })
      .eq('id', integration.id);

    return report;
  } catch (err) {
    await supabaseAdmin
      .from('integrations')
      .update({ pull_status: 'failed' })
      .eq('id', integration.id);

    throw new Error(`QBO P&L pull failed: ${err.message}`);
  }
}
