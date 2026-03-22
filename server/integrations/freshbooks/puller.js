import { supabaseAdmin } from '../../db/supabase.js';
import { ensureFreshToken } from './auth.js';

export async function pullProfitAndLoss(userId, { start_date, end_date }) {
  const accessToken = await ensureFreshToken(userId);

  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('realm_id')
    .eq('user_id', userId)
    .eq('provider', 'freshbooks')
    .single();

  if (!integration?.realm_id) throw new Error('FreshBooks account not found');

  const from = start_date || new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
  const to = end_date || new Date().toISOString().split('T')[0];

  const url = `https://api.freshbooks.com/accounting/account/${integration.realm_id}/reports/accounting/profitloss?start_date=${from}&end_date=${to}`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`FreshBooks P&L fetch failed (${resp.status}): ${errBody}`);
  }

  const data = await resp.json();

  await supabaseAdmin
    .from('integrations')
    .update({ last_pulled_at: new Date().toISOString(), pull_status: 'success' })
    .eq('user_id', userId)
    .eq('provider', 'freshbooks');

  return data.response?.result?.profitloss || data;
}
