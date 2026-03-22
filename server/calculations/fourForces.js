export function calculateFourForces(waterfall, inputs) {
  // V4: Operating Cash Flow = Revenue - COGS - Direct Labor - Marketing - OpEx
  const operating_cash_flow =
    waterfall.total_revenue -
    waterfall.total_cogs -
    waterfall.total_direct_labor -
    waterfall.total_marketing -
    waterfall.total_opex;

  // V4 Four Forces allocation
  // Force 1: Tax Reserve = operating_cash_flow * tax_rate
  const tax_rate = inputs.tax_rate || 0.40;
  const force1_tax_reserve = operating_cash_flow > 0 ? operating_cash_flow * tax_rate : 0;

  // Force 2: Debt Service = user-entered monthly debt payment * 12
  const monthly_debt_payment = inputs.monthly_debt_payment || 0;
  const force2_debt_service = monthly_debt_payment * 12;

  // Force 3: Core Capital = (total_opex / 12) * core_capital_months
  const core_capital_months = inputs.core_capital_months || 2;
  const monthly_opex = waterfall.total_opex / 12;
  const force3_core_capital = monthly_opex * core_capital_months;

  // Force 4: Distribution = Operating Cash Flow - Force1 - Force2 - Force3
  const force4_distribution = operating_cash_flow - force1_tax_reserve - force2_debt_service - force3_core_capital;

  const core_capital_months_covered = monthly_opex > 0
    ? force3_core_capital / monthly_opex
    : 0;

  return {
    operating_cash_flow,
    force1_tax_reserve,
    force1_monthly: force1_tax_reserve / 12,
    force1_pct: tax_rate,
    force2_debt_service,
    force2_monthly: force2_debt_service / 12,
    force2_annual_debt: force2_debt_service,
    force3_core_capital,
    force3_monthly: force3_core_capital / 12,
    force3_target_months: core_capital_months,
    force4_distribution,
    force4_monthly: force4_distribution / 12,
    distribution_negative: force4_distribution < 0,
    core_capital_target: force3_core_capital,
    core_capital_months_covered,
    monthly_debt_payment,
  };
}
