import { safeDivide } from './utils.js';

export function calculateHireImpact(waterfall, hireInputs, assumptions) {
  const benefits_pct = hireInputs.benefits_pct || 0.15;
  const loaded_cost = hireInputs.annual_wage * (1 + benefits_pct);
  const is_direct = hireInputs.is_direct_labor !== undefined
    ? hireInputs.is_direct_labor
    : (hireInputs.type || 'direct').toLowerCase() === 'direct';
  const expected_revenue = hireInputs.expected_revenue_enabled || hireInputs.expected_revenue || 0;
  const gm_pct = waterfall.gm_pct;

  const before = {
    revenue: waterfall.total_revenue,
    gross_margin: waterfall.gross_margin,
    direct_labor: waterfall.total_direct_labor,
    direct_lpr: safeDivide(waterfall.gross_margin, waterfall.total_direct_labor),
    contribution_margin: waterfall.contribution_margin,
    opex: waterfall.total_opex,
    manpr: safeDivide(waterfall.contribution_margin, waterfall.total_opex),
    marketing: waterfall.total_marketing,
    pretax_profit: waterfall.pretax_net_income,
    pretax_pct: waterfall.pretax_pct,
  };

  // V4 5H: Rebuild full P&L waterfall with hire added
  const new_revenue = waterfall.total_revenue + expected_revenue;
  const new_gross_margin = new_revenue * gm_pct;
  const new_direct_labor = is_direct
    ? waterfall.total_direct_labor + loaded_cost
    : waterfall.total_direct_labor;
  const new_direct_lpr = safeDivide(new_gross_margin, new_direct_labor);
  const new_contribution_margin = new_gross_margin - new_direct_labor;
  const new_opex = is_direct
    ? waterfall.total_opex
    : waterfall.total_opex + loaded_cost;
  const new_manpr = safeDivide(new_contribution_margin, new_opex);
  const new_pretax_profit = new_contribution_margin - waterfall.total_marketing - new_opex;
  const new_pretax_pct = safeDivide(new_pretax_profit, new_revenue);

  const after = {
    revenue: new_revenue,
    gross_margin: new_gross_margin,
    direct_labor: new_direct_labor,
    direct_lpr: new_direct_lpr,
    contribution_margin: new_contribution_margin,
    opex: new_opex,
    manpr: new_manpr,
    marketing: waterfall.total_marketing,
    pretax_profit: new_pretax_profit,
    pretax_pct: new_pretax_pct,
  };

  // V4 verdict: PASS if all three metrics hit targets
  let verdict = 'NO';
  const fails = [
    new_direct_lpr < 2.5,
    new_manpr < 1.0,
    new_pretax_pct < 0.10,
  ].filter(Boolean).length;

  if (fails === 0) verdict = 'PASS';
  else if (fails === 1) verdict = 'CAUTION';

  // Revenue needed to break even on hire = loaded_cost / cm_pct
  const revenue_breakeven_for_hire = waterfall.cm_pct > 0
    ? loaded_cost / waterfall.cm_pct
    : 0;
  const revenue_gap = expected_revenue - revenue_breakeven_for_hire;

  return {
    hire_wage: hireInputs.annual_wage,
    benefits_pct,
    loaded_cost,
    is_direct,
    expected_revenue,
    before,
    after,
    verdict,
    revenue_breakeven_for_hire,
    revenue_gap,
    hire_pays_for_itself: revenue_gap >= 0,
  };
}
