import { safeDivide, round2 } from './utils.js';

export function calculateOwnerPayRoadmap(ownerPayGap, waterfall, inputs) {
  const { owner_pay_gap, current_total_owner_pay, target_total_owner_comp } = ownerPayGap;
  const monthly_gap_closure = owner_pay_gap / 12;

  // V4 5J: 12-month step ramp
  const roadmap = [];
  for (let month = 1; month <= 12; month++) {
    const cumulative_raise = monthly_gap_closure * month;
    const new_monthly_comp = (current_total_owner_pay / 12) + cumulative_raise;
    const pct_of_target = safeDivide(new_monthly_comp, target_total_owner_comp / 12);
    const revenue_required = waterfall.cm_pct > 0
      ? (new_monthly_comp * 12) / waterfall.cm_pct
      : 0;

    roadmap.push({
      month,
      cumulative_raise: round2(cumulative_raise),
      new_monthly_comp: round2(new_monthly_comp),
      pct_of_target: Math.min(pct_of_target, 1),
      revenue_required: round2(revenue_required),
    });
  }

  // V4 5J: Four gap closure options
  const gap_closure_options = {
    raise_prices: {
      label: 'Raise Prices',
      detail: safeDivide(owner_pay_gap, waterfall.total_revenue * waterfall.cm_pct),
      formatted: `${(safeDivide(owner_pay_gap, waterfall.total_revenue * waterfall.cm_pct) * 100).toFixed(1)}% price increase`,
    },
    grow_revenue: {
      label: 'Grow Revenue',
      detail: waterfall.cm_pct > 0 ? owner_pay_gap / waterfall.cm_pct : 0,
      formatted: `$${round2(waterfall.cm_pct > 0 ? owner_pay_gap / waterfall.cm_pct : 0).toLocaleString()} additional revenue`,
    },
    cut_direct_labor: {
      label: 'Cut Direct Labor',
      detail: owner_pay_gap,
      formatted: `$${round2(owner_pay_gap).toLocaleString()} labor reduction (dollar for dollar)`,
    },
    cut_overhead: {
      label: 'Cut Overhead',
      detail: owner_pay_gap,
      formatted: `$${round2(owner_pay_gap).toLocaleString()} OpEx reduction (dollar for dollar)`,
    },
  };

  // Reality check
  const reality_check = {
    profit_at_10_pct: waterfall.total_revenue * 0.10,
    combined_with_wage: (waterfall.total_revenue * 0.10) + (inputs.owner_market_wage_annual || 0),
    monthly_comp: ((waterfall.total_revenue * 0.10) + (inputs.owner_market_wage_annual || 0)) / 12,
  };

  return {
    owner_pay_gap,
    monthly_gap_closure: round2(monthly_gap_closure),
    roadmap,
    gap_closure_options,
    reality_check,
  };
}
