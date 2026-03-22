import { safeDivide } from './utils.js';
import { LPR_THRESHOLDS } from '../../shared/constants.js';

export function generateStaticActionPlan(waterfall, ratios, ownerPayGapData, profitTierData) {
  const actions = [];
  const dLPR_target = LPR_THRESHOLDS.direct_lpr.target_low;
  const manPR_target = LPR_THRESHOLDS.manpr.target;

  if (ratios.direct_lpr < dLPR_target && ratios.direct_lpr_status !== 'none') {
    const target_gm = waterfall.total_direct_labor * dLPR_target;
    const dollar_gap = target_gm - waterfall.gross_margin;
    actions.push({
      category: 'Direct LPR',
      title: ratios.direct_lpr < 2.0
        ? 'Fix your labor pricing immediately. You are working for free on most jobs.'
        : `Tighten labor efficiency or raise prices to hit ${dLPR_target}x Direct LPR.`,
      dollar_impact: Math.abs(dollar_gap),
      score_impact: ratios.direct_lpr < 2.0 ? 25 : 10,
      difficulty: ratios.direct_lpr < 2.0 ? 'Hard' : 'Medium',
      timeline: ratios.direct_lpr < 2.0 ? 'This week' : 'This month',
    });
  }

  if (ratios.mpr < 5.0 && ratios.mpr_status !== 'none') {
    const target_gm_from_mkt = waterfall.total_marketing * 5.0;
    const dollar_gap = target_gm_from_mkt - waterfall.gross_margin;
    actions.push({
      category: 'MPR',
      title: ratios.mpr < 3.0
        ? 'Your marketing spend is not generating enough return. Cut or redirect.'
        : 'Optimize marketing to hit 5x return on every dollar spent.',
      dollar_impact: Math.abs(dollar_gap),
      score_impact: ratios.mpr < 3.0 ? 20 : 8,
      difficulty: 'Medium',
      timeline: 'This month',
    });
  }

  if (ratios.manpr < manPR_target && ratios.manpr_status !== 'none') {
    const overhead_excess = waterfall.total_opex - waterfall.contribution_margin;
    actions.push({
      category: 'ManPR',
      title: ratios.manpr < 0.75
        ? 'Overhead is crushing your margins. Cut non-essential expenses now.'
        : 'Reduce overhead or grow contribution margin to cover management costs.',
      dollar_impact: Math.abs(overhead_excess),
      score_impact: ratios.manpr < 0.75 ? 20 : 8,
      difficulty: 'Medium',
      timeline: 'This month',
    });
  }

  const owner_gap_pct = ownerPayGapData.gap_pct;
  if (owner_gap_pct > 0.20) {
    actions.push({
      category: 'Owner Pay',
      title: 'You are leaving money on the table. Your pay gap needs to close.',
      dollar_impact: ownerPayGapData.owner_pay_gap,
      score_impact: owner_gap_pct > 0.50 ? 10 : 4,
      difficulty: 'Medium',
      timeline: 'This quarter',
    });
  }

  if (waterfall.pretax_pct < 0.05) {
    actions.push({
      category: 'Profitability',
      title: waterfall.pretax_pct < 0
        ? 'Your business is losing money. Stop the bleeding before anything else.'
        : 'You are below the 10% profit floor. This is your top priority.',
      dollar_impact: Math.abs(waterfall.total_revenue * (0.10 - waterfall.pretax_pct)),
      score_impact: waterfall.pretax_pct < 0 ? 25 : 12,
      difficulty: 'Hard',
      timeline: 'This week',
    });
  }

  actions.sort((a, b) => b.score_impact - a.score_impact);

  const top3 = actions.slice(0, 3).map((action, i) => ({
    priority: i + 1,
    ...action,
  }));

  return { actions: top3, total_score_impact: top3.reduce((s, a) => s + a.score_impact, 0) };
}
