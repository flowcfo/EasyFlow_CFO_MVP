import { supabaseAdmin } from '../../db/supabase.js';
import { ensureFreshToken } from './auth.js';

export async function pullProfitAndLoss(userId, { start_date, end_date }) {
  const accessToken = await ensureFreshToken(userId);

  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('realm_id')
    .eq('user_id', userId)
    .eq('provider', 'xero')
    .single();

  if (!integration?.realm_id) throw new Error('Xero tenant not found');

  const from = start_date || new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
  const to = end_date || new Date().toISOString().split('T')[0];

  const url = `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=${from}&toDate=${to}`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-Tenant-Id': integration.realm_id,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Xero P&L fetch failed (${resp.status}): ${errBody}`);
  }

  const data = await resp.json();

  await supabaseAdmin
    .from('integrations')
    .update({ last_pulled_at: new Date().toISOString(), pull_status: 'success' })
    .eq('user_id', userId)
    .eq('provider', 'xero');

  return data.Reports?.[0] || data;
}
