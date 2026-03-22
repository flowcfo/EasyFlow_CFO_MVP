/**
 * Maps Wave GraphQL P&L report to Easy Numbers input fields.
 * Wave returns { income: [], costOfGoodsSold: [], expenses: [] }
 */

const LINE_KEYWORDS = {
  employee_direct_labor: ['wages', 'salaries', 'payroll', 'labor', 'employee'],
  subcontractors: ['subcontractor', 'contractor', '1099', 'freelance'],
  marketing: ['advertising', 'marketing', 'promotion'],
  rent: ['rent', 'lease', 'occupancy', 'office space'],
  insurance: ['insurance'],
  software_subscriptions: ['software', 'subscription', 'computer', 'cloud'],
};

function matchLineCategory(label) {
  const lower = (label || '').toLowerCase();
  for (const [cat, keywords] of Object.entries(LINE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return null;
}

function sumEntries(entries) {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((sum, e) => sum + Math.abs(parseFloat(e.total?.value || 0)), 0);
}

export function mapWaveToInputs(report) {
  const income = report?.income || [];
  const cogs = report?.costOfGoodsSold || [];
  const expenses = report?.expenses || [];

  const results = {
    revenue: sumEntries(income),
    cogs: sumEntries(cogs),
    employee_direct_labor: 0,
    subcontractors: 0,
    marketing: 0,
    rent: 0,
    insurance: 0,
    software_subscriptions: 0,
    other_opex: 0,
  };

  for (const expense of expenses) {
    const label = expense.accountName || '';
    const amount = Math.abs(parseFloat(expense.total?.value || 0));
    if (isNaN(amount) || amount === 0) continue;

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
    sources[key] = results[key] !== undefined && results[key] > 0 ? 'wave' : 'manual';
  }
  sources.owner_direct_labor = 'manual';
  sources.owner_management_wage = 'manual';
  sources.owner_market_wage_annual = 'manual';
  sources.tax_rate = 'manual';
  sources.core_capital_months = 'manual';

  return { inputs, sources };
}
