/**
 * Maps Xero ProfitAndLoss report to Easy Numbers input fields.
 *
 * Xero P&L reports use a Rows[] structure with RowType: "Section",
 * each containing Rows[] of RowType: "Row" with Cells[].
 */

const SECTION_KEYWORDS = {
  income: ['income', 'revenue', 'sales', 'trading income'],
  cogs: ['cost of sales', 'cost of goods', 'direct costs'],
  expenses: ['expense', 'operating expense', 'overhead'],
};

const LINE_KEYWORDS = {
  employee_direct_labor: ['wages', 'salaries', 'payroll', 'direct labor', 'field labor'],
  subcontractors: ['subcontractor', 'contractor', '1099', 'outside services'],
  marketing: ['advertising', 'marketing', 'promotion', 'ads'],
  rent: ['rent', 'lease', 'occupancy'],
  insurance: ['insurance', 'liability', 'workers comp'],
  software_subscriptions: ['software', 'subscription', 'computer', 'cloud', 'hosting'],
};

function matchLineCategory(label) {
  const lower = label.toLowerCase();
  for (const [cat, keywords] of Object.entries(LINE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return null;
}

function extractFromXeroReport(report) {
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

  const rows = report?.Rows || [];

  for (const section of rows) {
    if (section.RowType !== 'Section') continue;

    const title = (section.Title || '').toLowerCase();
    const isIncome = SECTION_KEYWORDS.income.some((kw) => title.includes(kw));
    const isCOGS = SECTION_KEYWORDS.cogs.some((kw) => title.includes(kw));
    const isExpenses = SECTION_KEYWORDS.expenses.some((kw) => title.includes(kw));

    for (const row of (section.Rows || [])) {
      if (row.RowType === 'SummaryRow') continue;
      const cells = row.Cells || [];
      const label = cells[0]?.Value || '';
      const amount = Math.abs(parseFloat(cells[1]?.Value) || 0);

      if (isIncome) {
        results.revenue += amount;
      } else if (isCOGS) {
        results.cogs += amount;
      } else if (isExpenses) {
        const category = matchLineCategory(label);
        if (category) {
          results[category] += amount;
        } else {
          results.other_opex += amount;
        }
      }
    }
  }

  return results;
}

export function mapXeroToInputs(report) {
  const parsed = extractFromXeroReport(report);

  const inputs = {
    ...parsed,
    owner_direct_labor: 0,
    owner_management_wage: 0,
    owner_market_wage_annual: 0,
    tax_rate: 0.40,
    core_capital_months: 2,
  };

  const sources = {};
  for (const key of Object.keys(inputs)) {
    sources[key] = parsed[key] !== undefined && parsed[key] > 0 ? 'xero' : 'manual';
  }
  sources.owner_direct_labor = 'manual';
  sources.owner_management_wage = 'manual';
  sources.owner_market_wage_annual = 'manual';
  sources.tax_rate = 'manual';
  sources.core_capital_months = 'manual';

  return { inputs, sources };
}
