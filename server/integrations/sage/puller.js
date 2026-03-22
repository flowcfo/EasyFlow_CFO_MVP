import { supabaseAdmin } from '../../db/supabase.js';
import { ensureFreshToken } from './auth.js';

export async function pullProfitAndLoss(userId, { start_date, end_date }) {
  const accessToken = await ensureFreshToken(userId);

  const from = start_date || new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
  const to = end_date || new Date().toISOString().split('T')[0];

  const url = `https://api.accounting.sage.com/v3.1/profit_and_loss?from_date=${from}&to_date=${to}`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Sage P&L fetch failed (${resp.status}): ${errBody}`);
  }

  const data = await resp.json();

  await supabaseAdmin
    .from('integrations')
    .update({ last_pulled_at: new Date().toISOString(), pull_status: 'success' })
    .eq('user_id', userId)
    .eq('provider', 'sage');

  return data;
}
