import { safeDivide } from './utils.js';

export function calculateOwnerPayGap(waterfall, inputs) {
  // V4 5D: Owner Pay Gap
  // current_total_owner_pay = owner_direct_labor + owner_management_wage
  const current_total_owner_pay = waterfall.owner_direct_labor + waterfall.owner_management_wage;

  // target_total_owner_comp = owner_market_wage_annual + (total_revenue * 0.10)
  const owner_market_wage = inputs.owner_market_wage_annual || 0;
  const target_total_owner_comp = owner_market_wage + (waterfall.total_revenue * 0.10);

  // owner_pay_gap = target - current
  const owner_pay_gap = target_total_owner_comp - current_total_owner_pay;

  // gap_pct = gap / target_total_owner_comp
  const gap_pct = safeDivide(owner_pay_gap, target_total_owner_comp);

  const monthly_gap = owner_pay_gap / 12;

  return {
    current_total_owner_pay,
    current_monthly_pay: current_total_owner_pay / 12,
    target_market_wage: owner_market_wage,
    target_revenue_distribution: waterfall.total_revenue * 0.10,
    target_total_owner_comp,
    target_monthly_comp: target_total_owner_comp / 12,
    owner_pay_gap,
    monthly_gap,
    gap_pct,
    gap_negative: owner_pay_gap > 0,
    gap_closed: owner_pay_gap <= 0,
  };
}
