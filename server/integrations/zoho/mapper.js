const INCOME_KEYWORDS = ['income', 'revenue', 'sales', 'service revenue', 'consulting'];
const COGS_KEYWORDS = ['cost of goods', 'cost of sales', 'cogs', 'materials', 'supplies', 'direct cost'];
const LABOR_KEYWORDS = ['payroll', 'wages', 'salaries', 'labor', 'employee', 'compensation', 'contractor', 'subcontract'];
const MARKETING_KEYWORDS = ['marketing', 'advertising', 'ads', 'promotion', 'media', 'seo', 'social media'];
const RENT_KEYWORDS = ['rent', 'lease', 'facility', 'office space'];
const INSURANCE_KEYWORDS = ['insurance', 'liability', 'workers comp', 'health insurance'];
const SOFTWARE_KEYWORDS = ['software', 'subscription', 'saas', 'license', 'cloud', 'hosting'];

function matchCategory(label) {
  const lower = (label || '').toLowerCase();
  if (INCOME_KEYWORDS.some((k) => lower.includes(k))) return 'revenue';
  if (COGS_KEYWORDS.some((k) => lower.includes(k))) return 'cogs';
  if (LABOR_KEYWORDS.some((k) => lower.includes(k))) return 'employee_direct_labor';
  if (MARKETING_KEYWORDS.some((k) => lower.includes(k))) return 'marketing';
  if (RENT_KEYWORDS.some((k) => lower.includes(k))) return 'rent';
  if (INSURANCE_KEYWORDS.some((k) => lower.includes(k))) return 'insurance';
  if (SOFTWARE_KEYWORDS.some((k) => lower.includes(k))) return 'software_subscriptions';
  return null;
}

function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(/[,$()]/g, '')) || 0;
  return 0;
}

function processLineItems(items, results, fieldSources) {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const label = item.account_name || item.name || '';
    const amount = parseAmount(item.total || item.amount || 0);
    const category = matchCategory(label);

    if (category && amount !== 0) {
      results[category] += Math.abs(amount);
      if (!fieldSources[category]) fieldSources[category] = [];
      fieldSources[category].push({ label, amount: Math.abs(amount), source: 'zoho' });
    }

    if (item.line_items || item.accounts) {
      processLineItems(item.line_items || item.accounts, results, fieldSources);
    }
  }
}

export function mapZohoToInputs(report) {
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
    owner_direct_labor: 0,
    owner_management_wage: 0,
    owner_market_wage_annual: 0,
    tax_rate: 0.40,
    core_capital_months: 2,
  };

  const fieldSources = {};

  const profitAndLoss = report?.profitandloss || report;

  // Process income
  if (profitAndLoss.income) {
    for (const item of profitAndLoss.income) {
      const amount = parseAmount(item.total || item.amount || 0);
      results.revenue += Math.abs(amount);
      if (!fieldSources.revenue) fieldSources.revenue = [];
      fieldSources.revenue.push({
        label: item.account_name || 'Income',
        amount: Math.abs(amount),
        source: 'zoho',
      });
    }
  }

  // Process COGS
  if (profitAndLoss.cost_of_goods_sold) {
    for (const item of profitAndLoss.cost_of_goods_sold) {
      const label = item.account_name || '';
      const amount = parseAmount(item.total || item.amount || 0);
      const category = matchCategory(label);

      if (category === 'employee_direct_labor' || LABOR_KEYWORDS.some((k) => label.toLowerCase().includes(k))) {
        results.employee_direct_labor += Math.abs(amount);
        if (!fieldSources.employee_direct_labor) fieldSources.employee_direct_labor = [];
        fieldSources.employee_direct_labor.push({ label, amount: Math.abs(amount), source: 'zoho' });
      } else {
        results.cogs += Math.abs(amount);
        if (!fieldSources.cogs) fieldSources.cogs = [];
        fieldSources.cogs.push({ label, amount: Math.abs(amount), source: 'zoho' });
      }
    }
  }

  // Process operating expenses
  if (profitAndLoss.expenses || profitAndLoss.operating_expenses) {
    const expenses = profitAndLoss.expenses || profitAndLoss.operating_expenses;
    processLineItems(expenses, results, fieldSources);
  }

  // Catch-all: any unmapped expense goes to other_opex
  const mappedExpenses = results.marketing + results.rent + results.insurance + results.software_subscriptions;
  const totalExpenses = parseAmount(profitAndLoss.total_expenses || 0);
  const totalCogs = parseAmount(profitAndLoss.total_cost_of_goods_sold || 0);
  const unmapped = totalExpenses - totalCogs - mappedExpenses - results.employee_direct_labor;
  if (unmapped > 0) {
    results.other_opex = unmapped;
  }

  return {
    inputs: results,
    sources: fieldSources,
    metadata: {
      provider: 'zoho',
      mapped_at: new Date().toISOString(),
    },
  };
}
