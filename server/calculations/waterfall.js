import { safeDivide } from './utils.js';

export function calculateWaterfall(inputs) {
  const total_revenue = inputs.revenue;
  const total_cogs = inputs.cogs;
  const gross_margin = total_revenue - total_cogs;
  const gm_pct = safeDivide(gross_margin, total_revenue);

  const owner_direct_labor = inputs.owner_direct_labor;
  const employee_direct_labor = inputs.employee_direct_labor;
  const subcontractors = inputs.subcontractors;
  const total_direct_labor = owner_direct_labor + employee_direct_labor + subcontractors;

  const contribution_margin = gross_margin - total_direct_labor;
  const cm_pct = safeDivide(contribution_margin, total_revenue);

  const total_marketing = inputs.marketing;

  const owner_management_wage = inputs.owner_management_wage;
  const rent = inputs.rent;
  const insurance = inputs.insurance;
  const software_subscriptions = inputs.software_subscriptions;
  const other_opex = inputs.other_opex;
  const total_opex = owner_management_wage + rent + insurance + software_subscriptions + other_opex;

  const total_mgmt_and_opex = total_marketing + total_opex;

  const pretax_net_income = contribution_margin - total_mgmt_and_opex;
  const pretax_pct = safeDivide(pretax_net_income, total_revenue);

  // V4: True Pretax Profit = Pretax Net Income + Owner Direct Labor + Owner Management Wage
  // Adds back both halves of actual owner pay for the "true" picture of business earnings
  const true_pretax_profit = pretax_net_income + owner_direct_labor + owner_management_wage;
  const true_pretax_pct = safeDivide(true_pretax_profit, total_revenue);

  // V4: Tax on pretax_net_income (not true_pretax_profit)
  const tax_rate = inputs.tax_rate;
  const estimated_tax = pretax_net_income > 0 ? pretax_net_income * tax_rate : 0;

  const post_tax_cash_flow = true_pretax_profit - estimated_tax;

  const cogs_pct = safeDivide(total_cogs, total_revenue);

  return {
    total_revenue,
    total_cogs,
    cogs_pct,
    gross_margin,
    gm_pct,
    owner_direct_labor,
    employee_direct_labor,
    subcontractors,
    total_direct_labor,
    contribution_margin,
    cm_pct,
    total_marketing,
    owner_management_wage,
    rent,
    insurance,
    software_subscriptions,
    other_opex,
    total_opex,
    total_mgmt_and_opex,
    pretax_net_income,
    pretax_pct,
    true_pretax_profit,
    true_pretax_pct,
    tax_rate,
    estimated_tax,
    post_tax_cash_flow,
  };
}
