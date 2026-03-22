import { safeDivide } from './utils.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Sort month keys like "2024-01", "2024-02" chronologically.
 */
function sortedKeys(history) {
  return Object.keys(history).sort();
}

/**
 * Group monthly data into rolling 12-month windows.
 * Returns an array of { label, start, end, totals } where each totals
 * object sums the Easy Numbers fields across that 12-month window.
 */
export function buildRolling12Periods(monthlyHistory) {
  if (!monthlyHistory) return [];
  const keys = sortedKeys(monthlyHistory);
  if (keys.length < 12) return [];

  const periods = [];
  for (let i = 11; i < keys.length; i++) {
    const windowKeys = keys.slice(i - 11, i + 1);
    const totals = {
      revenue: 0, cogs: 0, employee_direct_labor: 0, subcontractors: 0,
      marketing: 0, owner_management_wage: 0, rent: 0, insurance: 0,
      software_subscriptions: 0, other_opex: 0, owner_pay_detected: 0,
      owner_direct_labor: 0,
    };

    for (const k of windowKeys) {
      const m = monthlyHistory[k];
      if (!m) continue;
      for (const field of Object.keys(totals)) {
        totals[field] += m[field] || 0;
      }
    }

    const endParts = windowKeys[11].split('-');
    const startParts = windowKeys[0].split('-');
    const endLabel = `${MONTH_NAMES[parseInt(endParts[1]) - 1]} ${endParts[0]}`;
    const startLabel = `${MONTH_NAMES[parseInt(startParts[1]) - 1]} ${startParts[0]}`;

    totals.total_direct_labor = totals.owner_direct_labor + totals.employee_direct_labor + totals.subcontractors;
    totals.gross_margin = totals.revenue - totals.cogs;
    totals.contribution_margin = totals.gross_margin - totals.total_direct_labor;
    totals.total_opex = totals.owner_management_wage + totals.rent + totals.insurance
      + totals.software_subscriptions + totals.other_opex;
    totals.pretax = totals.contribution_margin - totals.marketing - totals.total_opex;
    totals.pretax_pct = safeDivide(totals.pretax, totals.revenue);

    periods.push({
      label: `${startLabel} – ${endLabel}`,
      start: windowKeys[0],
      end: windowKeys[11],
      totals,
    });
  }

  return periods;
}

/**
 * Calculate month-over-month trend (growth rate) from historical data.
 * Returns per-field linear growth rates based on the last N months of data.
 */
function calculateMonthlyTrends(monthlyHistory, lookbackMonths = 12) {
  const keys = sortedKeys(monthlyHistory);
  const recentKeys = keys.slice(-lookbackMonths);
  if (recentKeys.length < 3) return null;

  const trends = {};
  const fields = ['revenue', 'cogs', 'employee_direct_labor', 'subcontractors',
    'marketing', 'owner_management_wage', 'rent', 'insurance',
    'software_subscriptions', 'other_opex'];

  for (const field of fields) {
    const values = recentKeys.map((k) => monthlyHistory[k]?.[field] || 0);
    const nonZero = values.filter((v) => v > 0);
    if (nonZero.length < 2) {
      trends[field] = 0;
      continue;
    }

    // Simple average month-over-month growth rate
    let totalGrowth = 0;
    let count = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        totalGrowth += (values[i] - values[i - 1]) / values[i - 1];
        count++;
      }
    }
    trends[field] = count > 0 ? totalGrowth / count : 0;
  }

  return trends;
}

/**
 * Get seasonality factors: for each calendar month (1-12),
 * calculate the ratio of that month's average to the overall monthly average.
 * Returns an array of 12 factors indexed 0-11.
 */
function calculateSeasonality(monthlyHistory, field = 'revenue') {
  const keys = sortedKeys(monthlyHistory);
  if (keys.length < 12) return null;

  const byMonth = Array.from({ length: 12 }, () => []);

  for (const k of keys) {
    const m = parseInt(k.split('-')[1]) - 1;
    const val = monthlyHistory[k]?.[field] || 0;
    if (val > 0) byMonth[m].push(val);
  }

  const monthAvgs = byMonth.map((arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const overallAvg = monthAvgs.reduce((a, b) => a + b, 0) / 12;

  if (overallAvg <= 0) return null;

  return monthAvgs.map((avg) => avg > 0 ? avg / overallAvg : 1.0);
}

/**
 * Build a 12-month trend-based forecast using historical monthly data.
 *
 * Strategy:
 *   1. Use the most recent month's values as a baseline
 *   2. Apply month-over-month growth trend
 *   3. Apply seasonality adjustment if enough history (24+ months)
 *   4. Allow manual growth rate override
 *
 * @param {object} monthlyHistory - { '2024-01': { revenue: X, ... }, ... }
 * @param {object} waterfall - current annual waterfall from calculation engine
 * @param {object} inputs - current inputs
 * @param {number} growthOverride - manual growth override (0 = use trend)
 * @returns {object} { months, annual_totals, trends, seasonality, rolling12 }
 */
export function calculateTrendForecast(monthlyHistory, waterfall, inputs, growthOverride = null) {
  const hasHistory = monthlyHistory && Object.keys(monthlyHistory).length >= 3;

  // Fallback: no history, use flat annual / 12 (existing behavior)
  if (!hasHistory) {
    return buildFlatForecast(waterfall, inputs, growthOverride || 0);
  }

  const keys = sortedKeys(monthlyHistory);
  const trends = calculateMonthlyTrends(monthlyHistory);
  const seasonality = keys.length >= 24 ? calculateSeasonality(monthlyHistory) : null;

  // Baseline: average of last 3 months to smooth spikes
  const last3 = keys.slice(-3);
  const baseline = {};
  const fields = ['revenue', 'cogs', 'employee_direct_labor', 'subcontractors',
    'marketing', 'owner_management_wage', 'rent', 'insurance',
    'software_subscriptions', 'other_opex'];

  for (const f of fields) {
    baseline[f] = last3.reduce((sum, k) => sum + (monthlyHistory[k]?.[f] || 0), 0) / last3.length;
  }
  baseline.owner_direct_labor = inputs.owner_direct_labor / 12 || 0;

  // Determine start month for forecast (month after the last data month)
  const lastKey = keys[keys.length - 1];
  let [startYear, startMonth] = lastKey.split('-').map(Number);
  startMonth++;
  if (startMonth > 12) { startMonth = 1; startYear++; }

  const months = [];
  const totals = {
    revenue: 0, cogs: 0, gross_margin: 0, direct_labor: 0,
    contribution_margin: 0, marketing: 0, opex: 0, pretax: 0,
    tax: 0, post_tax: 0,
  };

  for (let i = 0; i < 12; i++) {
    const calMonth = ((startMonth - 1 + i) % 12);
    const calYear = startYear + Math.floor((startMonth - 1 + i) / 12);
    const monthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`;

    // Apply growth rate (override or trend) per field
    const gf = (field) => {
      const rate = growthOverride !== null ? growthOverride : (trends?.[field] || 0);
      return Math.pow(1 + rate, i);
    };

    // Apply seasonality factor if available
    const sf = seasonality ? seasonality[calMonth] : 1.0;

    const rev = baseline.revenue * gf('revenue') * sf;
    const cogs = baseline.cogs * gf('cogs') * sf;
    const gm = rev - cogs;
    const dl = (baseline.employee_direct_labor * gf('employee_direct_labor')
      + baseline.subcontractors * gf('subcontractors')
      + baseline.owner_direct_labor) * sf;
    const cm = gm - dl;
    const mkt = baseline.marketing * gf('marketing') * sf;
    const opex = (baseline.owner_management_wage + baseline.rent + baseline.insurance
      + baseline.software_subscriptions + baseline.other_opex) * sf;
    const pretax = cm - mkt - opex;
    const tax = pretax > 0 ? pretax * (inputs.tax_rate || 0.40) : 0;
    const postTax = pretax - tax;

    totals.revenue += rev;
    totals.cogs += cogs;
    totals.gross_margin += gm;
    totals.direct_labor += dl;
    totals.contribution_margin += cm;
    totals.marketing += mkt;
    totals.opex += opex;
    totals.pretax += pretax;
    totals.tax += tax;
    totals.post_tax += postTax;

    months.push({
      month: monthLabel,
      month_num: i + 1,
      cal_month: calMonth + 1,
      cal_year: calYear,
      revenue: Math.round(rev),
      cogs: Math.round(cogs),
      gross_margin: Math.round(gm),
      direct_labor: Math.round(dl),
      contribution_margin: Math.round(cm),
      marketing: Math.round(mkt),
      opex: Math.round(opex),
      pretax: Math.round(pretax),
      pretax_pct: safeDivide(pretax, rev),
      tax: Math.round(tax),
      post_tax: Math.round(postTax),
    });
  }

  const breakeven_month = months.findIndex((m) => m.pretax_pct >= 0.10);

  // Historical months for the chart overlay
  const historicalMonths = keys.slice(-24).map((k) => {
    const m = monthlyHistory[k];
    const [y, mo] = k.split('-').map(Number);
    const rev = m?.revenue || 0;
    const c = m?.cogs || 0;
    const gm = rev - c;
    const dl = (m?.employee_direct_labor || 0) + (m?.subcontractors || 0) + (m?.owner_direct_labor || 0);
    const cm = gm - dl;
    const mkt = m?.marketing || 0;
    const opx = (m?.owner_management_wage || 0) + (m?.rent || 0) + (m?.insurance || 0)
      + (m?.software_subscriptions || 0) + (m?.other_opex || 0);
    const pretax = cm - mkt - opx;
    return {
      month: `${MONTH_NAMES[mo - 1]} ${y}`,
      revenue: Math.round(rev),
      pretax: Math.round(pretax),
      type: 'actual',
    };
  });

  // Rolling 12-month comparison
  const rolling12 = buildRolling12Periods(monthlyHistory);

  return {
    months,
    annual_totals: totals,
    trends,
    seasonality: seasonality || null,
    has_seasonality: !!seasonality,
    historical_months: historicalMonths,
    rolling12,
    breakeven_month: breakeven_month >= 0 ? breakeven_month + 1 : null,
    data_months: keys.length,
    forecast_start: `${MONTH_NAMES[startMonth - 1]} ${startYear}`,
  };
}

function buildFlatForecast(waterfall, inputs, growthRate) {
  const months = [];
  const cogs_pct = waterfall.cogs_pct;
  const laborRatio = safeDivide(waterfall.total_direct_labor, waterfall.gross_margin);
  const mkt = waterfall.total_marketing / 12;
  const opex = waterfall.total_opex / 12;
  const totals = {
    revenue: 0, cogs: 0, gross_margin: 0, direct_labor: 0,
    contribution_margin: 0, marketing: 0, opex: 0, pretax: 0,
    tax: 0, post_tax: 0,
  };

  for (let i = 0; i < 12; i++) {
    const gf = Math.pow(1 + growthRate, i);
    const rev = (waterfall.total_revenue / 12) * gf;
    const c = rev * cogs_pct;
    const gm = rev - c;
    const dl = gm * laborRatio;
    const cm = gm - dl;
    const pretax = cm - mkt - opex;
    const tax = pretax > 0 ? pretax * (inputs.tax_rate || 0.40) : 0;
    const postTax = pretax - tax;

    totals.revenue += rev;
    totals.gross_margin += gm;
    totals.contribution_margin += cm;
    totals.pretax += pretax;
    totals.post_tax += postTax;

    months.push({
      month: `M${i + 1}`,
      month_num: i + 1,
      revenue: Math.round(rev),
      gross_margin: Math.round(gm),
      contribution_margin: Math.round(cm),
      pretax: Math.round(pretax),
      pretax_pct: safeDivide(pretax, rev),
    });
  }

  const be = months.findIndex((m) => m.pretax_pct >= 0.10);

  return {
    months,
    annual_totals: totals,
    trends: null,
    seasonality: null,
    has_seasonality: false,
    historical_months: [],
    rolling12: [],
    breakeven_month: be >= 0 ? be + 1 : null,
    data_months: 0,
    forecast_start: null,
  };
}
