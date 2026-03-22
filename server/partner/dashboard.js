import { supabaseAdmin } from '../db/supabase.js';

export async function getPartnerDashboard(partnerId) {
  const { data: clients, error: clientsErr } = await supabaseAdmin
    .from('partner_clients')
    .select('*')
    .eq('partner_id', partnerId)
    .order('added_at', { ascending: false });

  if (clientsErr) throw clientsErr;

  const clientCards = [];
  const tierDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalScore = 0;
  let scoredClients = 0;

  for (const client of clients || []) {
    const { data: gameProgress } = await supabaseAdmin
      .from('game_progress')
      .select('profit_score, profit_tier, current_streak, score_history')
      .eq('user_id', client.client_user_id)
      .single();

    const { data: latestSnapshot } = await supabaseAdmin
      .from('snapshots')
      .select('created_at')
      .eq('user_id', client.client_user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const score = gameProgress?.profit_score || 0;
    const tier = gameProgress?.profit_tier || 1;
    const streak = gameProgress?.current_streak || 0;
    const lastActivity = latestSnapshot?.created_at || client.added_at;

    if (gameProgress) {
      totalScore += score;
      scoredClients++;
      tierDistribution[tier]++;
    }

    clientCards.push({
      id: client.id,
      client_user_id: client.client_user_id,
      client_name: client.client_name,
      business_name: client.business_name,
      status: client.status,
      profit_score: score,
      profit_tier: tier,
      current_streak: streak,
      last_activity: lastActivity,
      score_history: gameProgress?.score_history || [],
    });
  }

  clientCards.sort((a, b) => a.profit_score - b.profit_score);

  return {
    total_clients: clients?.length || 0,
    avg_portfolio_score: scoredClients > 0 ? Math.round(totalScore / scoredClients) : 0,
    tier_distribution: tierDistribution,
    client_cards: clientCards,
  };
}

export async function getPartnerAlerts(partnerId) {
  const { data: clients } = await supabaseAdmin
    .from('partner_clients')
    .select('client_user_id, client_name, business_name')
    .eq('partner_id', partnerId)
    .eq('status', 'active');

  const alerts = [];

  for (const client of clients || []) {
    const { data: gameProgress } = await supabaseAdmin
      .from('game_progress')
      .select('profit_score, profit_tier, current_streak, last_checkin_date, score_history')
      .eq('user_id', client.client_user_id)
      .single();

    if (!gameProgress) continue;

    const history = gameProgress.score_history || [];
    if (history.length >= 2) {
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      const scoreDrop = previous.score - latest.score;

      if (scoreDrop >= 8) {
        alerts.push({
          type: 'score_drop',
          severity: 'high',
          client_user_id: client.client_user_id,
          client_name: client.client_name,
          business_name: client.business_name,
          message: `Score dropped ${scoreDrop} points since last snapshot.`,
          value: scoreDrop,
        });
      }

      if (latest.score > previous.score && gameProgress.profit_tier > (previous.tier || 0)) {
        alerts.push({
          type: 'level_up',
          severity: 'positive',
          client_user_id: client.client_user_id,
          client_name: client.client_name,
          business_name: client.business_name,
          message: `Leveled up to Tier ${gameProgress.profit_tier}.`,
          value: gameProgress.profit_tier,
        });
      }
    }

    if (gameProgress.last_checkin_date) {
      const daysSince = Math.floor(
        (Date.now() - new Date(gameProgress.last_checkin_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince >= 10) {
        alerts.push({
          type: 'streak_broken',
          severity: 'medium',
          client_user_id: client.client_user_id,
          client_name: client.client_name,
          business_name: client.business_name,
          message: `No check-in for ${daysSince} days. Streak at risk.`,
          value: daysSince,
        });
      }
    }
  }

  alerts.sort((a, b) => {
    const severity = { high: 0, medium: 1, positive: 2 };
    return (severity[a.severity] || 3) - (severity[b.severity] || 3);
  });

  return alerts;
}
