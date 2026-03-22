import { refreshAccessToken } from './auth.js';
import { supabaseAdmin } from '../../db/supabase.js';

export async function pullZohoProfitAndLoss(userId, dateRange) {
  const accessToken = await refreshAccessToken(userId);

  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('realm_id')
    .eq('user_id', userId)
    .eq('provider', 'zoho')
    .single();

  const organizationId = integration?.realm_id;
  if (!organizationId) throw new Error('Zoho organization ID not found');

  const { start_date, end_date } = dateRange;

  const params = new URLSearchParams({
    from_date: start_date,
    to_date: end_date,
    organization_id: organizationId,
  });

  const response = await fetch(
    `https://books.zoho.com/api/v3/reports/profitandloss?${params.toString()}`,
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    await supabaseAdmin
      .from('integrations')
      .update({ pull_status: 'failed' })
      .eq('user_id', userId)
      .eq('provider', 'zoho');
    throw new Error(`Zoho API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  await supabaseAdmin
    .from('integrations')
    .update({
      last_pulled_at: new Date().toISOString(),
      pull_status: 'success',
    })
    .eq('user_id', userId)
    .eq('provider', 'zoho');

  return data;
}
