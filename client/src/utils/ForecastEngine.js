/**
 * ForecastEngine.js
 * Pure calculation logic for the EasyFlow CFO 5-year profit forecast.
 * No UI or React dependencies. All values in whole dollars unless noted.
 *
 * Input assumptions:
 *   - inputs:        Annual values (matching shared/schema.js INPUT_SHAPE)
 *   - monthlyHistory: { "YYYY-MM": { revenue, cogs, owner_direct_labor, ... } }
 *                    Monthly actual P&L values; TTM sum = annual total
 */

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const LINE_ITEMS = [
  'revenue','cogs','owner_direct_labor','employee_direct_labor','subcontractors',
  'marketing','owner_management_wage','rent','insurance','software_subscriptions','other_opex',
];

function sd(a, b, fb = 0) {
  if (!b || !isFinite(b)) return fb;
  const r = a / b;
  return isFinite(r) ? r : fb;
}

function validHistoryKeys(monthlyHistory) {
  if (!monthlyHistory) return [];
  return Object.keys(monthlyHistory)
    .filter(k => /^\d{4}-\d{2}$/.test(k))
    .sort();
}

// ─── Block 1: Rolling 12 Baseline ────────────────────────────────────────────
// Pulls TTM totals from history (or annualized inputs if history is sparse).
// All values stored as annual totals so /12 always gives monthly average.

function computeBaseline(inputs, monthlyHistory) {
  const keys = validHistoryKeys(monthlyHistory);
  const ttmKeys = keys.slice(-12);

  const ttm = {};
  for (const f of LINE_ITEMS) ttm[f] = 0;

  if (ttmKeys.length >= 1) {
    for (const k of ttmKeys) {
      const row = monthlyHistory[k] || {};
      for (const f of LINE_ITEMS) ttm[f] += row[f] || 0;
    }
  } else {
    // No history — treat inputs as annual values
    for (const f of LINE_ITEMS) ttm[f] = inputs[f] || 0;
  }

  const gm          = ttm.revenue - ttm.cogs;
  const directLabor = ttm.owner_direct_labor + ttm.employee_direct_labor + ttm.subcontractors;
  const cm          = gm - directLabor;
  const opex        = ttm.owner_management_wage + ttm.rent + ttm.insurance
                      + ttm.software_subscriptions + ttm.other_opex;
  const pretax      = cm - ttm.marketing - opex;

  return {
    ttm,
    gm, directLabor, cm, opex, pretax,
    gmPct:     sd(gm, ttm.revenue),
    cmPct:     sd(cm, ttm.revenue),
    pretaxPct: sd(pretax, ttm.revenue),
    directLPR: sd(gm, directLabor),
    mpr:       sd(gm, ttm.marketing),
    manPR:     sd(cm, ttm.owner_management_wage),
    historyKeys: keys,
    ttmKeys,
    ttmMonths: ttmKeys.length,
  };
}

// ─── Block 2: Year-Over-Year Pattern Analysis ─────────────────────────────────
// Requires 13+ months for YoY, 24+ for meaningful seasonality.
// seasonalityIndex: 12 multipliers that redistribute annual totals by month.
//   Each multiplier = (avg for that calendar month) / (overall monthly avg)
//   Sum of 12 multipliers = 12 so that (annual/12) × sum = annual.

function computeSeasonality(monthlyHistory) {
  const keys = validHistoryKeys(monthlyHistory);
  const flat = Array(12).fill(1.0);

  const empty = {
    seasonalityIndex: Object.fromEntries(LINE_ITEMS.map(f => [f, [...flat]])),
    yoyGrowthRates:   Object.fromEntries(LINE_ITEMS.map(f => [f, 0])),
    volatileLines:    [],
    hasSeasonality:   false,
    hasYoY:           false,
  };
  if (keys.length < 13) return empty;

  const hasSeasonality = keys.length >= 24;
  const seasonalityIndex = {};

  for (const field of LINE_ITEMS) {
    if (!hasSeasonality) { seasonalityIndex[field] = [...flat]; continue; }

    const byMonth = Array.from({ length: 12 }, () => []);
    for (const k of keys) {
      const mo  = parseInt(k.split('-')[1], 10) - 1;
      const val = monthlyHistory[k]?.[field] ?? 0;
      if (val > 0) byMonth[mo].push(val);
    }
    const monthAvgs  = byMonth.map(arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const overallAvg = monthAvgs.reduce((a, b) => a + b, 0) / 12;
    seasonalityIndex[field] = overallAvg > 0
      ? monthAvgs.map(avg => avg > 0 ? avg / overallAvg : 1.0)
      : [...flat];
  }

  // YoY growth rates per line item; flag volatile lines (stdDev > 20%)
  const yoyGrowthRates = {};
  const volatileLines  = [];

  for (const field of LINE_ITEMS) {
    const deltas = [];
    for (const k of keys) {
      const [y, m] = k.split('-').map(Number);
      const prevKey = `${y - 1}-${String(m).padStart(2, '0')}`;
      if (!monthlyHistory[prevKey]) continue;
      const cur  = monthlyHistory[k]?.[field] ?? 0;
      const prev = monthlyHistory[prevKey]?.[field] ?? 0;
      if (prev > 0) deltas.push((cur - prev) / prev);
    }
    if (deltas.length > 0) {
      const avg      = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const variance = deltas.reduce((s, d) => s + (d - avg) ** 2, 0) / deltas.length;
      yoyGrowthRates[field] = avg;
      if (Math.sqrt(variance) > 0.20) volatileLines.push(field);
    } else {
      yoyGrowthRates[field] = 0;
    }
  }

  return { seasonalityIndex, yoyGrowthRates, volatileLines, hasSeasonality, hasYoY: true };
}

// ─── Block 3: True Breakeven (monthly, seasonal) ──────────────────────────────
// EasyFlow CPA correction: BOTH halves of owner pay are always in Fixed Costs.
//   Fixed Costs = Marketing + Full OpEx (incl. Row 42) + Owner Direct Labor (Row 23)
//   True Breakeven = Fixed Costs / (CM% − Target Profit %)
// Seasonal multipliers shift breakeven up/down each month.

function computeBreakeven(baseline, seasonality, targetProfit = 0.10, ownerPayAnnualOverride = null) {
  // Determine owner pay to use (override or TTM actuals)
  if (ownerPayAnnualOverride !== null) {
    // Override splits 50/50 between Row 23 and Row 42
    const half = ownerPayAnnualOverride / 2;
    baseline = {
      ...baseline,
      ttm: { ...baseline.ttm, owner_direct_labor: half, owner_management_wage: half },
    };
  }

  // Monthly fixed costs — full owner pay always included
  const fixedCostsMo = (
    baseline.ttm.marketing
    + baseline.ttm.owner_management_wage   // Row 42
    + baseline.ttm.rent
    + baseline.ttm.insurance
    + baseline.ttm.software_subscriptions
    + baseline.ttm.other_opex
    + baseline.ttm.owner_direct_labor      // Row 23 — the CPA correction
  ) / 12;

  const denominator = baseline.cmPct - targetProfit;
  const revSeasonal = seasonality.seasonalityIndex?.revenue || Array(12).fill(1.0);

  if (denominator <= 0) return Array(12).fill(Infinity);

  const baseBreakeven = fixedCostsMo / denominator;
  return revSeasonal.map(s => Math.round(baseBreakeven * s));
}

// ─── Blocks 4, 5 & 6: Forecast + Target Solver + Action Triggers ─────────────
// 60 months across 5 years. Each line item maintains its TTM ratio to revenue,
// except owner pay which is held constant (owner always gets paid first).
//
// Growth compounding schedule:
//   Year 1: base × (1 + g)
//   Year 2: Year1 × (1 + g)
//   Year 3: Year2 × (1 + g × 0.85)       ← dampening starts
//   Year 4: Year3 × (1 + g × 0.85²)
//   Year 5: Year4 × (1 + g × 0.85³)

function computeForecastData(baseline, seasonality, breakevenByMonth, overrides) {
  const { revenueGrowth, ownerPayAnnual, targetProfit = 0.10 } = overrides;

  const revGrowth = (revenueGrowth !== null && revenueGrowth !== undefined)
    ? revenueGrowth
    : Math.max(0, seasonality.yoyGrowthRates?.revenue || 0);

  const ownerPayMo  = (ownerPayAnnual !== null && ownerPayAnnual !== undefined)
    ? ownerPayAnnual / 12
    : (baseline.ttm.owner_direct_labor + baseline.ttm.owner_management_wage) / 12;
  const ownerDLMo   = ownerPayMo * 0.5;  // Row 23: always 50%
  const ownerMgmtMo = ownerPayMo * 0.5;  // Row 42: always 50%

  // Revenue-proportional ratios from TTM baseline
  const cogsRatio  = sd(baseline.ttm.cogs,                      baseline.ttm.revenue);
  const empDLRatio = sd(baseline.ttm.employee_direct_labor,      baseline.ttm.revenue);
  const subDLRatio = sd(baseline.ttm.subcontractors,             baseline.ttm.revenue);
  const mktRatio   = sd(baseline.ttm.marketing,                  baseline.ttm.revenue);

  // Fixed overhead (non-owner) — held constant
  const fixedRentMo  = baseline.ttm.rent / 12;
  const fixedInsMo   = baseline.ttm.insurance / 12;
  const fixedSoftMo  = baseline.ttm.software_subscriptions / 12;
  const fixedOtherMo = baseline.ttm.other_opex / 12;

  // Required revenue denominator (Block 5)
  const fixedCostsMo = (
    baseline.ttm.marketing
    + baseline.ttm.owner_management_wage
    + baseline.ttm.rent
    + baseline.ttm.insurance
    + baseline.ttm.software_subscriptions
    + baseline.ttm.other_opex
    + baseline.ttm.owner_direct_labor
  ) / 12;
  const reqDenom = baseline.cmPct - targetProfit;

  // Determine forecast start month
  const { historyKeys } = baseline;
  let startYear, startMonthIdx;
  if (historyKeys.length > 0) {
    let [ly, lm] = historyKeys[historyKeys.length - 1].split('-').map(Number);
    lm += 1;
    if (lm > 12) { lm = 1; ly += 1; }
    startYear = ly;
    startMonthIdx = lm - 1; // 0-indexed
  } else {
    const now = new Date();
    startYear     = now.getFullYear();
    startMonthIdx = now.getMonth();
  }

  const revSeasonal = seasonality.seasonalityIndex?.revenue || Array(12).fill(1.0);

  // Cumulative annual growth factor relative to baseline
  function annualGrowthFactor(yearIdx) {
    let factor = 1.0;
    for (let y = 0; y <= yearIdx; y++) {
      const g = y >= 2 ? revGrowth * Math.pow(0.85, y - 2) : revGrowth;
      factor *= (1 + g);
    }
    return factor;
  }

  const forecastData          = [];
  const requiredRevenueByMonth = [];

  for (let m = 0; m < 60; m++) {
    const yearIdx      = Math.floor(m / 12);
    const calMonthIdx  = (startMonthIdx + m) % 12;
    const calYear      = startYear + Math.floor((startMonthIdx + m) / 12);

    const gf       = annualGrowthFactor(yearIdx);
    const sf       = revSeasonal[calMonthIdx];
    const annualRev = baseline.ttm.revenue * gf;

    // P&L waterfall
    const revenue            = Math.round((annualRev / 12) * sf);
    const cogs               = Math.round(revenue * cogsRatio);
    const grossMargin        = revenue - cogs;
    const empDL              = Math.round(revenue * empDLRatio);
    const subDL              = Math.round(revenue * subDLRatio);
    const directLabor        = Math.round(ownerDLMo + empDL + subDL);
    const contributionMargin = grossMargin - directLabor;
    const marketing          = Math.round(revenue * mktRatio);
    const opex               = Math.round(ownerMgmtMo + fixedRentMo + fixedInsMo + fixedSoftMo + fixedOtherMo);
    const pretaxIncome       = contributionMargin - marketing - opex;

    // Ratios
    const gmPct    = sd(grossMargin, revenue);
    const cmPct    = sd(contributionMargin, revenue);
    const pretaxPct = sd(pretaxIncome, revenue);
    const directLPR = sd(grossMargin, directLabor);
    const mpr       = sd(grossMargin, marketing);
    const manPR     = sd(contributionMargin, ownerMgmtMo);

    // Seasonal breakeven (Block 3 output, repeating 12-month pattern)
    const breakeven   = breakevenByMonth[calMonthIdx] ?? breakevenByMonth[0];
    const revenueGap  = breakeven === Infinity ? 0 : revenue - breakeven;

    // Status
    let status;
    if (breakeven === Infinity || revenue < breakeven || pretaxPct < 0.05) {
      status = 'critical';
    } else if (revenue < breakeven * 1.15 || pretaxPct < 0.10) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    // Action trigger (Block 6) — only for non-healthy months
    let actionTrigger = null;
    if (status !== 'healthy') {
      if (directLPR < 2.5)  actionTrigger = 'Job Leak. Revenue or labor mix problem.';
      else if (mpr < 5)      actionTrigger = 'Marketing Leak. Spend is not converting.';
      else if (manPR < 1.0)  actionTrigger = 'Overhead Leak. Fixed costs too high for this revenue level.';
      else                    actionTrigger = 'Breakeven Gap. Revenue is the only fix.';
    }

    // Required revenue — back-solved from target profit % (Block 5)
    const reqRev = reqDenom > 0
      ? Math.round((fixedCostsMo / reqDenom) * sf)
      : Infinity;
    requiredRevenueByMonth.push(reqRev);

    forecastData.push({
      month:             `${MONTH_NAMES[calMonthIdx]} ${calYear}`,
      monthKey:          `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}`,
      year:              yearIdx + 1,
      yearLabel:         `Year ${yearIdx + 1}`,
      revenue,
      cogs,
      grossMargin,
      gmPct,
      directLabor,
      contributionMargin,
      cmPct,
      marketing,
      opex,
      pretaxIncome,
      pretaxPct,
      directLPR,
      mpr,
      manPR,
      breakeven,
      revenueGap,
      status,
      actionTrigger,
    });
  }

  return { forecastData, requiredRevenueByMonth };
}

// Annual rollup of 12-month segments
function buildSummaryByYear(forecastData, requiredRevenueByMonth) {
  return Array.from({ length: 5 }, (_, y) => {
    const months    = forecastData.slice(y * 12, (y + 1) * 12);
    const reqMonths = requiredRevenueByMonth.slice(y * 12, (y + 1) * 12);
    const sum = f => months.reduce((s, m) => s + (m[f] || 0), 0);

    const revenue            = sum('revenue');
    const grossMargin        = sum('grossMargin');
    const contributionMargin = sum('contributionMargin');
    const pretaxIncome       = sum('pretaxIncome');
    const directLabor        = sum('directLabor');
    const marketing          = sum('marketing');
    const totalOwnerMgmt     = months.reduce((s, m) => s + m.opex, 0);
    const requiredRevenue    = reqMonths.reduce((s, v) => s + (isFinite(v) ? v : 0), 0);

    const sc = { healthy: 0, warning: 0, critical: 0 };
    for (const m of months) sc[m.status]++;
    const status = sc.critical > 3 ? 'critical'
      : (sc.warning > 3 || sc.critical > 0) ? 'warning'
      : 'healthy';

    return {
      year:             y + 1,
      yearLabel:        `Year ${y + 1}`,
      revenue,
      grossMargin,
      gmPct:            sd(grossMargin, revenue),
      contributionMargin,
      cmPct:            sd(contributionMargin, revenue),
      pretaxIncome,
      pretaxPct:        sd(pretaxIncome, revenue),
      directLPR:        sd(grossMargin, directLabor),
      mpr:              sd(grossMargin, marketing),
      manPR:            sd(contributionMargin, totalOwnerMgmt / 12),
      requiredRevenue,
      revenueGap:       revenue - requiredRevenue,
      status,
      statusCounts:     sc,
    };
  });
}

// ─── Main Export ──────────────────────────────────────────────────────────────
/**
 * Run the full 5-year profit forecast.
 *
 * @param {object} inputs         - Annual inputs matching INPUT_SHAPE
 * @param {object} monthlyHistory - { "YYYY-MM": { revenue, cogs, ... } }
 * @param {object} overrides      - { targetProfit, revenueGrowth, ownerPayAnnual }
 */
export function runForecast(inputs = {}, monthlyHistory = {}, overrides = {}) {
  const { targetProfit = 0.10, revenueGrowth = null, ownerPayAnnual = null } = overrides;

  const baseline      = computeBaseline(inputs, monthlyHistory);
  const seasonality   = computeSeasonality(monthlyHistory);
  const breakevenByMonth = computeBreakeven(baseline, seasonality, targetProfit, ownerPayAnnual);

  const { forecastData, requiredRevenueByMonth } = computeForecastData(
    baseline, seasonality, breakevenByMonth,
    { revenueGrowth, ownerPayAnnual, targetProfit },
  );

  const summaryByYear = buildSummaryByYear(forecastData, requiredRevenueByMonth);

  return {
    forecastData,
    summaryByYear,
    baselineRatios: {
      gmPct:             baseline.gmPct,
      cmPct:             baseline.cmPct,
      pretaxPct:         baseline.pretaxPct,
      directLPR:         baseline.directLPR,
      mpr:               baseline.mpr,
      manPR:             baseline.manPR,
      revenue:           baseline.ttm.revenue,
      grossMargin:       baseline.gm,
      contributionMargin: baseline.cm,
      pretaxIncome:      baseline.pretax,
      directLabor:       baseline.directLabor,
      marketing:         baseline.ttm.marketing,
      opex:              baseline.opex,
    },
    breakevenByMonth,
    seasonalityIndex:       seasonality.seasonalityIndex,
    volatileLines:          seasonality.volatileLines,
    requiredRevenueByMonth,
    forecastStart:          forecastData[0]?.monthKey || '',
    defaultGrowthRate:      Math.max(0, seasonality.yoyGrowthRates?.revenue || 0),
    defaultOwnerPayAnnual:  baseline.ttm.owner_direct_labor + baseline.ttm.owner_management_wage,
    hasHistory:             baseline.ttmMonths >= 3,
    hasSeasonality:         seasonality.hasSeasonality,
    historyKeys:            baseline.historyKeys,
  };
}
