import { safeDivide } from './utils.js';
import { BREAKEVEN_TARGETS } from '../../shared/constants.js';

export function calculateBreakeven(waterfall, inputs) {
  // V4 5E: True Breakeven
  const cm_pct = waterfall.cm_pct;
  const fixed_costs = waterfall.total_mgmt_and_opex;
  const operatingMonths = Math.min(12, Math.max(1, Math.round(Number(inputs.operating_months_per_year) || 12)));

  const scenarios = BREAKEVEN_TARGETS.map((target_profit_pct) => {
    const denominator = cm_pct - target_profit_pct;
    const required_revenue = denominator > 0 ? safeDivide(fixed_costs, denominator) : 0;
    const required_monthly = operatingMonths > 0 ? required_revenue / operatingMonths : 0;

    const pretax_profit_at_target = required_revenue * target_profit_pct;
    const owner_market_wage = inputs.owner_market_wage_annual || 0;
    const total_owner_comp = pretax_profit_at_target + owner_market_wage;
    const estimated_tax = total_owner_comp > 0 ? total_owner_comp * (inputs.tax_rate || 0.40) : 0;
    const after_tax_owner_cash = total_owner_comp - estimated_tax;

    return {
      target_profit_pct,
      required_revenue,
      required_monthly,
      pretax_profit_at_target,
      total_owner_comp,
      estimated_tax,
      after_tax_owner_cash,
      is_achievable: denominator > 0,
    };
  });

  const cpa_breakeven = scenarios[0];
  const true_breakeven = scenarios[3]; // 10%
  const breakeven_lie_gap = true_breakeven.required_revenue - cpa_breakeven.required_revenue;

  return {
    scenarios,
    cpa_breakeven,
    true_breakeven,
    breakeven_lie_gap,
    current_revenue: waterfall.total_revenue,
    cm_pct,
    fixed_costs,
    operating_months_per_year: operatingMonths,
  };
}
