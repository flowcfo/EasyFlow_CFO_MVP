/**
 * Maps FreshBooks Profit & Loss report to Easy Numbers input fields.
 * FreshBooks P&L uses { income: [], expenses: [], cost_of_goods_sold: [] } structure.
 */

const LINE_KEYWORDS = {
  employee_direct_labor: ['wages', 'salaries', 'payroll', 'labor'],
  subcontractors: ['subcontractor', 'contractor', '1099'],
  marketing: ['advertising', 'marketing', 'promotion'],
  rent: ['rent', 'lease', 'occupancy'],
  insurance: ['insurance'],
  software_subscriptions: ['software', 'subscription', 'computer', 'hosting'],
};

function matchLineCategory(label) {
  const lower = (label || '').toLowerCase();
  for (const [cat, keywords] of Object.entries(LINE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return null;
}

function sumSection(entries) {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((sum, entry) => {
    const val = parseFloat(entry.total?.amount || entry.amount || 0);
    return sum + Math.abs(isNaN(val) ? 0 : val);
  }, 0);
}

export function mapFreshBooksToInputs(report) {
  const income = report?.income || [];
  const cogs = report?.cost_of_goods_sold || [];
  const expenses = report?.expenses || [];

  const results = {
    revenue: 0,
    cogs: 0,
    employee_direct_labor: 0,
    subcontractors: 0,
    marketing: 0,
    rent: 0,
    insurance: 0,
    software_subscriptions: 0,
    other_opex: 0,
  };

  results.revenue = sumSection(income);
  results.cogs = sumSection(cogs);

  for (const expense of expenses) {
    const label = expense.description || expense.account_name || '';
    const amount = Math.abs(parseFloat(expense.total?.amount || expense.amount || 0));
    if (isNaN(amount)) continue;

    const category = matchLineCategory(label);
    if (category) {
      results[category] += amount;
    } else {
      results.other_opex += amount;
    }
  }

  const inputs = {
    ...results,
    owner_direct_labor: 0,
    owner_management_wage: 0,
    owner_market_wage_annual: 0,
    tax_rate: 0.40,
    core_capital_months: 2,
  };

  const sources = {};
  for (const key of Object.keys(inputs)) {
    sources[key] = results[key] !== undefined && results[key] > 0 ? 'freshbooks' : 'manual';
  }
  sources.owner_direct_labor = 'manual';
  sources.owner_management_wage = 'manual';
  sources.owner_market_wage_annual = 'manual';
  sources.tax_rate = 'manual';
  sources.core_capital_months = 'manual';

  return { inputs, sources };
}
