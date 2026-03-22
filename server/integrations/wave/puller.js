import { supabaseAdmin } from '../../db/supabase.js';
import { ensureFreshToken } from './auth.js';

const WAVE_GQL = 'https://gql.waveapps.com/graphql/public';

const PL_QUERY = `
query ProfitAndLoss($businessId: ID!, $startDate: Date!, $endDate: Date!) {
  business(id: $businessId) {
    profitLossReport(startDate: $startDate, endDate: $endDate) {
      startDate
      endDate
      income {
        accountName
        total { value currency { code } }
      }
      costOfGoodsSold {
        accountName
        total { value currency { code } }
      }
      expenses {
        accountName
        total { value currency { code } }
      }
      netIncome { value currency { code } }
    }
  }
}`;

export async function pullProfitAndLoss(userId, { start_date, end_date }) {
  const accessToken = await ensureFreshToken(userId);

  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('realm_id')
    .eq('user_id', userId)
    .eq('provider', 'wave')
    .single();

  if (!integration?.realm_id) throw new Error('Wave business not found');

  const from = start_date || new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
  const to = end_date || new Date().toISOString().split('T')[0];

  const resp = await fetch(WAVE_GQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: PL_QUERY,
      variables: { businessId: integration.realm_id, startDate: from, endDate: to },
    }),
  });

  if (!resp.ok) throw new Error(`Wave P&L fetch failed: ${resp.status}`);
  const result = await resp.json();

  if (result.errors) {
    throw new Error(`Wave GraphQL error: ${result.errors[0]?.message}`);
  }

  await supabaseAdmin
    .from('integrations')
    .update({ last_pulled_at: new Date().toISOString(), pull_status: 'success' })
    .eq('user_id', userId)
    .eq('provider', 'wave');

  return result.data?.business?.profitLossReport || {};
}
