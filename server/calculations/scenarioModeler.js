import { safeDivide } from './utils.js';

export function calculateScenario(waterfall, adjustments) {
  const baseline = {
    revenue: waterfall.total_revenue,
    cogs_pct: waterfall.cogs_pct,
    gm_pct: waterfall.gm_pct,
    direct_labor: waterfall.total_direct_labor,
    marketing: waterfall.total_marketing,
    opex: waterfall.total_opex,
    pretax_profit: waterfall.pretax_net_income,
    pretax_pct: waterfall.pretax_pct,
    gross_margin: waterfall.gross_margin,
    direct_lpr: safeDivide(waterfall.gross_margin, waterfall.total_direct_labor),
    contribution_margin: waterfall.contribution_margin,
    cm_pct: waterfall.cm_pct,
    manpr: safeDivide(waterfall.contribution_margin, waterfall.total_opex),
  };

  // V4 5K: Six adjustable levers
  const rev_change_pct = adjustments.revenue_change_pct || 0;
  const price_increase_pct = adjustments.price_increase_pct || 0;
  const cogs_reduction_pct = adjustments.cogs_reduction_pct || 0;
  const labor_change = adjustments.direct_labor_change || 0;
  const marketing_change = adjustments.marketing_change || 0;
  const opex_change = adjustments.opex_change || 0;

  const scenario_revenue = baseline.revenue * (1 + rev_change_pct) * (1 + price_increase_pct);
  const scenario_cogs = scenario_revenue * (baseline.cogs_pct * (1 - cogs_reduction_pct));
  const scenario_gm = scenario_revenue - scenario_cogs;
  const scenario_gm_pct = safeDivide(scenario_gm, scenario_revenue);

  const scenario_direct_labor = baseline.direct_labor + labor_change;
  const scenario_direct_lpr = safeDivide(scenario_gm, scenario_direct_labor);
  const scenario_cm = scenario_gm - scenario_direct_labor;
  const scenario_cm_pct = safeDivide(scenario_cm, scenario_revenue);

  const scenario_marketing = baseline.marketing + marketing_change;
  const scenario_opex = baseline.opex + opex_change;
  const scenario_manpr = safeDivide(scenario_cm, scenario_opex);

  const scenario_pretax = scenario_cm - scenario_marketing - scenario_opex;
  const scenario_pretax_pct = safeDivide(scenario_pretax, scenario_revenue);

  // V4: Profit tier verdict
  let verdict_status = 'crisis';
  let verdict_color = 'red';
  if (scenario_pretax_pct >= 0.10) { verdict_status = 'healthy'; verdict_color = 'green'; }
  else if (scenario_pretax_pct >= 0.05) { verdict_status = 'survival'; verdict_color = 'yellow'; }

  const scenario = {
    revenue: scenario_revenue,
    cogs: scenario_cogs,
    gross_margin: scenario_gm,
    gm_pct: scenario_gm_pct,
    direct_labor: scenario_direct_labor,
    direct_lpr: scenario_direct_lpr,
    contribution_margin: scenario_cm,
    cm_pct: scenario_cm_pct,
    marketing: scenario_marketing,
    opex: scenario_opex,
    manpr: scenario_manpr,
    pretax_profit: scenario_pretax,
    pretax_pct: scenario_pretax_pct,
    verdict_status,
    verdict_color,
  };

  const delta = {
    revenue: scenario.revenue - baseline.revenue,
    gross_margin: scenario.gross_margin - baseline.gross_margin,
    direct_labor: scenario.direct_labor - baseline.direct_labor,
    direct_lpr: scenario.direct_lpr - baseline.direct_lpr,
    contribution_margin: scenario.contribution_margin - baseline.contribution_margin,
    marketing: scenario.marketing - baseline.marketing,
    opex: scenario.opex - baseline.opex,
    manpr: scenario.manpr - baseline.manpr,
    pretax_profit: scenario.pretax_profit - baseline.pretax_profit,
    pretax_pct: scenario.pretax_pct - baseline.pretax_pct,
  };

  return { baseline, scenario, delta, adjustments };
}
