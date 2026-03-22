import { safeDivide } from './utils.js';

export function calculateForecast(waterfall, inputs, monthly_growth_rate = 0) {
  const months = [];
  let annual_revenue = 0;
  let annual_gross_margin = 0;
  let annual_direct_labor = 0;
  let annual_contribution_margin = 0;
  let annual_marketing = 0;
  let annual_opex = 0;
  let annual_pretax = 0;
  let annual_tax = 0;
  let annual_post_tax = 0;

  const cogs_pct = waterfall.cogs_pct;
  const labor_to_gm_ratio = safeDivide(waterfall.total_direct_labor, waterfall.gross_margin);
  const monthly_marketing = waterfall.total_marketing / 12;
  const monthly_opex = waterfall.total_opex / 12;

  for (let i = 0; i < 12; i++) {
    const growth_factor = Math.pow(1 + monthly_growth_rate, i);
    const month_revenue = (waterfall.total_revenue / 12) * growth_factor;
    const month_cogs = month_revenue * cogs_pct;
    const month_gm = month_revenue - month_cogs;

    const month_direct_labor = month_gm * labor_to_gm_ratio;
    const month_cm = month_gm - month_direct_labor;

    // V4 5L: Pretax = CM - Marketing - OpEx
    const month_pretax = month_cm - monthly_marketing - monthly_opex;
    const month_pretax_pct = safeDivide(month_pretax, month_revenue);

    // V4: Tax on pretax (not true pretax)
    const month_tax = month_pretax > 0 ? month_pretax * (inputs.tax_rate || 0.40) : 0;
    const month_post_tax = month_pretax - month_tax;

    annual_revenue += month_revenue;
    annual_gross_margin += month_gm;
    annual_direct_labor += month_direct_labor;
    annual_contribution_margin += month_cm;
    annual_marketing += monthly_marketing;
    annual_opex += monthly_opex;
    annual_pretax += month_pretax;
    annual_tax += month_tax;
    annual_post_tax += month_post_tax;

    months.push({
      month: i + 1,
      revenue: month_revenue,
      cogs: month_cogs,
      gross_margin: month_gm,
      direct_labor: month_direct_labor,
      contribution_margin: month_cm,
      marketing: monthly_marketing,
      opex: monthly_opex,
      pretax: month_pretax,
      pretax_pct: month_pretax_pct,
      tax: month_tax,
      post_tax: month_post_tax,
    });
  }

  // V4: Breakeven month = first month pretax_pct hits 10%
  const breakeven_month = months.findIndex((m) => m.pretax_pct >= 0.10);

  return {
    months,
    annual_totals: {
      revenue: annual_revenue,
      gross_margin: annual_gross_margin,
      direct_labor: annual_direct_labor,
      contribution_margin: annual_contribution_margin,
      marketing: annual_marketing,
      opex: annual_opex,
      pretax: annual_pretax,
      tax: annual_tax,
      post_tax: annual_post_tax,
    },
    monthly_growth_rate,
    breakeven_month: breakeven_month >= 0 ? breakeven_month + 1 : null,
  };
}
