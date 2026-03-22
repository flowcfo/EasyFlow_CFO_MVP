/**
 * Maps Sage Business Cloud P&L report to Easy Numbers input fields.
 * Sage returns { income: { total, ledger_accounts: [] }, expenditure: { total, ledger_accounts: [] } }
 */

const LINE_KEYWORDS = {
  employee_direct_labor: ['wages', 'salaries', 'payroll', 'labor', 'employee costs'],
  subcontractors: ['subcontractor', 'contractor'],
  marketing: ['advertising', 'marketing', 'promotion'],
  rent: ['rent', 'lease', 'premises', 'property'],
  insurance: ['insurance'],
  software_subscriptions: ['software', 'subscription', 'computer', 'it costs'],
  cogs: ['cost of sales', 'cost of goods', 'materials', 'direct costs'],
};

function matchLineCategory(label) {
  const lower = (label || '').toLowerCase();
  for (const [cat, keywords] of Object.entries(LINE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return null;
}

export function mapSageToInputs(report) {
  const income = report?.income || report?.period?.income || {};
  const expenditure = report?.expenditure || report?.period?.expenditure || {};

  const results = {
    revenue: Math.abs(parseFloat(income.total || 0)),
    cogs: 0,
    employee_direct_labor: 0,
    subcontractors: 0,
    marketing: 0,
    rent: 0,
    insurance: 0,
    software_subscriptions: 0,
    other_opex: 0,
  };

  const accounts = expenditure.ledger_accounts || expenditure.categories || [];
  for (const acct of accounts) {
    const label = acct.name || acct.display_name || acct.ledger_account_group?.name || '';
    const amount = Math.abs(parseFloat(acct.total || acct.debit || 0));
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
    sources[key] = results[key] !== undefined && results[key] > 0 ? 'sage' : 'manual';
  }
  sources.owner_direct_labor = 'manual';
  sources.owner_management_wage = 'manual';
  sources.owner_market_wage_annual = 'manual';
  sources.tax_rate = 'manual';
  sources.core_capital_months = 'manual';

  return { inputs, sources };
}
