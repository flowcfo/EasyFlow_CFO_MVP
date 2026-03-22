import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { safeDivide } from './utils.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_TEMPLATE = path.join(
  'C:', 'Users', 'nmarc', 'EasyFlowCFO', 'templates', 'EasyFlow_CFO_P_L_Input.xlsx'
);

// ── Row group definitions ──────────────────────────────────
const REVENUE_ROWS = [5, 6, 7, 8, 9, 11];
const COGS_ROWS = [15, 16, 17, 18, 19, 20, 21, 22];
const OWNER_DL_ROWS = [29];
const EMPLOYEE_DL_ROWS = [30, 32, 33];
const TOTAL_DL_ROWS = [29, 30, 32, 33];
const MARKETING_ROWS = [42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55];
const OWNER_MGMT_ROWS = [70];
const RENT_ROWS = [62, 64];
const INSURANCE_ROWS = [77, 86];
const SOFTWARE_ROWS = [65, 89];
const PAYROLL_TAX_ROWS = [76, 78, 79];
const OTHER_OPEX_ROWS = [63, 66, 83, 84, 85, 87, 88, 90, 91, 92, 93, 94];
const ALL_OPEX_ROWS = [62, 63, 64, 65, 66, 70, 76, 77, 78, 79,
  83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94];
const INTEREST_ROW = 10;
const TAX_RATE_ROW = 102;

const ALL_INPUT_ROWS = [
  ...REVENUE_ROWS, INTEREST_ROW,
  ...COGS_ROWS,
  ...TOTAL_DL_ROWS,
  ...MARKETING_ROWS,
  ...ALL_OPEX_ROWS,
  TAX_RATE_ROW,
];

// ── In-memory cache ────────────────────────────────────────
let _cachedMonthlyData = null;
let _cachedAllWindows = null;

export function invalidateCache() {
  _cachedMonthlyData = null;
  _cachedAllWindows = null;
}

// ── Column index helpers ───────────────────────────────────
function colIndex(year, month) {
  return ((year - 2023) * 12) + (month - 1) + 1;
}

function colToYearMonth(col) {
  const zeroIdx = col - 1;
  const year = 2023 + Math.floor(zeroIdx / 12);
  const month = (zeroIdx % 12) + 1;
  return { year, month };
}

// ── FUNCTION 1: readMonthlyData ────────────────────────────
export function readMonthlyData(templatePath) {
  if (_cachedMonthlyData) return _cachedMonthlyData;

  const filePath = templatePath || DEFAULT_TEMPLATE;
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets['Easy_P&L_Input'];
  if (!ws) return null;

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: 0, raw: true });

  const months = [];
  let firstDataMonth = null;
  let lastDataMonth = null;
  let monthsWithData = 0;

  for (let ci = 1; ci <= 48; ci++) {
    const { year, month } = colToYearMonth(ci);
    const label = `${MONTH_NAMES[month - 1]} ${year}`;
    const rows = {};
    let hasAnyData = false;

    for (const rowNum of ALL_INPUT_ROWS) {
      const rowIdx = rowNum - 1;
      const val = data[rowIdx]?.[ci];
      const num = typeof val === 'number' ? val : (parseFloat(val) || 0);
      rows[rowNum] = num;
      if (num !== 0 && rowNum !== TAX_RATE_ROW) hasAnyData = true;
    }

    if (hasAnyData) {
      if (!firstDataMonth) firstDataMonth = { year, month };
      lastDataMonth = { year, month };
      monthsWithData++;
    }

    months.push({ year, month, label, col_index: ci, rows, has_data: hasAnyData });
  }

  // Tax rate: read from Row 102, first non-zero column, default 0.40
  let taxRate = 0.40;
  for (let ci = 1; ci <= 48; ci++) {
    const v = data[TAX_RATE_ROW - 1]?.[ci];
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (num && num > 0 && num < 1) {
      taxRate = num;
      break;
    }
  }

  _cachedMonthlyData = {
    months,
    tax_rate: taxRate,
    has_data_range: {
      first_month: firstDataMonth || { year: 2023, month: 1 },
      last_month: lastDataMonth || { year: 2023, month: 1 },
      months_with_any_data: monthsWithData,
    },
  };

  return _cachedMonthlyData;
}

/**
 * Build monthlyData from the in-memory monthlyHistory object
 * (from Excel or QBO imports stored in the frontend context).
 * This allows the Rolling 12 to work without a template file.
 * Covers ALL months present in the history, not just the template's 2023-2026 range.
 */
export function buildMonthlyDataFromHistory(monthlyHistory) {
  if (!monthlyHistory || Object.keys(monthlyHistory).length === 0) return null;

  const keys = Object.keys(monthlyHistory).sort();
  const [firstYear, firstMo] = keys[0].split('-').map(Number);
  const [lastYear, lastMo] = keys[keys.length - 1].split('-').map(Number);

  const months = [];
  let firstDataMonth = null;
  let lastDataMonth = null;
  let monthsWithData = 0;
  let ci = 1;

  for (let y = firstYear; y <= lastYear; y++) {
    const startM = (y === firstYear) ? firstMo : 1;
    const endM = (y === lastYear) ? lastMo : 12;
    for (let m = startM; m <= endM; m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[m - 1]} ${y}`;
      const hm = monthlyHistory[key];

      const rows = {};
      let hasAnyData = false;

      if (hm) {
        rows[5] = 0; rows[6] = 0; rows[7] = 0; rows[8] = 0; rows[9] = 0;
        rows[11] = hm.revenue || 0;
        rows[INTEREST_ROW] = 0;
        rows[15] = hm.subcontractors || 0;
        rows[16] = 0; rows[17] = hm.cogs || 0; rows[18] = 0;
        rows[19] = 0; rows[20] = 0; rows[21] = 0; rows[22] = 0;
        rows[29] = hm.owner_direct_labor || 0;
        rows[30] = hm.employee_direct_labor || 0;
        rows[32] = 0; rows[33] = 0;
        rows[42] = 0; rows[43] = 0; rows[44] = hm.marketing || 0;
        rows[45] = 0; rows[46] = 0; rows[47] = 0; rows[48] = 0; rows[49] = 0;
        rows[50] = 0; rows[51] = 0; rows[52] = 0; rows[53] = 0; rows[54] = 0; rows[55] = 0;
        rows[62] = hm.rent || 0; rows[63] = 0; rows[64] = 0; rows[65] = hm.software_subscriptions || 0;
        rows[66] = 0; rows[70] = hm.owner_management_wage || 0;
        rows[76] = 0; rows[77] = hm.insurance || 0; rows[78] = 0; rows[79] = 0;
        rows[83] = 0; rows[84] = 0; rows[85] = 0; rows[86] = 0;
        rows[87] = 0; rows[88] = 0; rows[89] = 0; rows[90] = 0;
        rows[91] = 0; rows[92] = 0; rows[93] = 0; rows[94] = hm.other_opex || 0;
        rows[TAX_RATE_ROW] = 0.40;

        for (const r of ALL_INPUT_ROWS) {
          if (!rows[r]) rows[r] = 0;
          if (rows[r] !== 0 && r !== TAX_RATE_ROW) hasAnyData = true;
        }
      } else {
        for (const r of ALL_INPUT_ROWS) rows[r] = 0;
      }

      if (hasAnyData) {
        if (!firstDataMonth) firstDataMonth = { year: y, month: m };
        lastDataMonth = { year: y, month: m };
        monthsWithData++;
      }

      months.push({ year: y, month: m, label, col_index: ci, rows, has_data: hasAnyData });
      ci++;
    }
  }

  return {
    months,
    tax_rate: 0.40,
    total_columns: months.length,
    has_data_range: {
      first_month: firstDataMonth || { year: firstYear, month: firstMo },
      last_month: lastDataMonth || { year: lastYear, month: lastMo },
      months_with_any_data: monthsWithData,
    },
  };
}

// ── FUNCTION 2: getAvailableWindows ────────────────────────
export function getAvailableWindows(monthlyData, limitYears = null) {
  if (!monthlyData) return [];

  const { months } = monthlyData;
  const totalMonths = months.length;
  const windows = [];

  // Find most recent month with data for the limit filter
  let mostRecentDataIdx = -1;
  for (let i = totalMonths - 1; i >= 0; i--) {
    if (months[i].has_data) { mostRecentDataIdx = i; break; }
  }

  // Earliest possible 12-month window ends at index 11
  const earliestEnd = Math.min(11, totalMonths - 1);
  for (let endIdx = earliestEnd; endIdx < totalMonths; endIdx++) {
    const startIdx = Math.max(0, endIdx - 11);
    const windowMonths = months.slice(startIdx, endIdx + 1);

    const monthsWithData = windowMonths.filter((m) => m.has_data).length;
    const hasAnyData = monthsWithData > 0;
    const endM = months[endIdx];
    const startM = months[startIdx];
    const windowSize = endIdx - startIdx + 1;

    const isLatest = endIdx === mostRecentDataIdx;

    windows.push({
      end_year: endM.year,
      end_month: endM.month,
      end_label: `${endM.label}${isLatest ? ' (TTM)' : ''}`,
      start_year: startM.year,
      start_month: startM.month,
      start_label: startM.label,
      months_in_window: windowSize,
      months_with_data: monthsWithData,
      data_coverage_pct: monthsWithData / 12,
      has_any_data: hasAnyData,
      is_partial: windowSize < 12,
      _end_idx: endIdx,
    });
  }

  let filtered = windows;
  if (limitYears && mostRecentDataIdx >= 0) {
    const cutoffIdx = mostRecentDataIdx - (limitYears * 12);
    filtered = windows.filter((w) => w._end_idx >= cutoffIdx);
  }

  // Sort most recent first
  filtered.sort((a, b) => b._end_idx - a._end_idx);

  return filtered;
}

// ── Sum helper ─────────────────────────────────────────────
function buildColMap(monthlyData) {
  const map = {};
  for (const m of monthlyData.months) {
    map[m.col_index] = m;
  }
  return map;
}

function sumRows(colMap, rowList, windowCols) {
  let total = 0;
  for (const ci of windowCols) {
    const m = colMap[ci];
    if (!m) continue;
    for (const r of rowList) {
      total += m.rows[r] || 0;
    }
  }
  return total;
}

// ── Profit tier ────────────────────────────────────────────
function getProfitTier(pretaxPct) {
  if (pretaxPct < 0) return { level: 1, name: 'Survival Mode', color: 'red' };
  if (pretaxPct < 0.05) return { level: 2, name: 'Getting Traction', color: 'orange' };
  if (pretaxPct < 0.10) return { level: 3, name: 'Stable Ground', color: 'yellow' };
  if (pretaxPct < 0.20) return { level: 4, name: 'Profit Machine', color: 'green' };
  return { level: 5, name: 'Wealth Mode', color: 'gold' };
}

// ── Score helpers ──────────────────────────────────────────
function lprScore(v) { return v >= 3.5 ? 25 : v >= 2.5 ? 20 : v >= 2.0 ? 12 : v >= 1.5 ? 6 : 0; }
function mprScore(v) { return v >= 5.0 ? 20 : v >= 3.0 ? 12 : v >= 2.0 ? 6 : 0; }
function manprScore(v) { return v >= 1.0 ? 20 : v >= 0.75 ? 12 : v >= 0.5 ? 6 : 0; }
function pretaxScore(v) { return v >= 0.20 ? 25 : v >= 0.10 ? 20 : v >= 0.05 ? 12 : v >= 0.0 ? 6 : 0; }

// ── Single-month waterfall (for sparklines) ────────────────
function calcSingleMonth(colMap, monthObj) {
  const cols = [monthObj.col_index];
  const rev = sumRows(colMap, REVENUE_ROWS, cols);
  const cogs = sumRows(colMap, COGS_ROWS, cols);
  const gm = rev - cogs;
  const dl = sumRows(colMap, TOTAL_DL_ROWS, cols);
  const cm = gm - dl;
  const mkt = sumRows(colMap, MARKETING_ROWS, cols);
  const opex = sumRows(colMap, ALL_OPEX_ROWS, cols);
  const pretax = cm - mkt - opex;

  return {
    year: monthObj.year,
    month: monthObj.month,
    label: monthObj.label,
    revenue: rev,
    gross_margin: gm,
    contribution_margin: cm,
    total_dl: dl,
    total_marketing: mkt,
    total_opex: opex,
    pretax_net_income: pretax,
    direct_lpr: safeDivide(gm, dl),
    mpr: safeDivide(gm, mkt),
    manpr: safeDivide(cm, opex),
  };
}

// ── FUNCTION 3: calculateRolling12 ────────────────────────
export function calculateRolling12(monthlyData, endYear, endMonth) {
  if (!monthlyData) return null;

  const { months } = monthlyData;

  // Find end month index in the months array
  const endIdx = months.findIndex((m) => m.year === endYear && m.month === endMonth);
  if (endIdx < 0) return null;

  const startIdx = Math.max(0, endIdx - 11);
  const windowCols = [];
  for (let i = startIdx; i <= endIdx; i++) windowCols.push(months[i].col_index);
  const actualMonths = windowCols.length;

  const startYM = { year: months[startIdx].year, month: months[startIdx].month };
  const endYM = { year: months[endIdx].year, month: months[endIdx].month };

  // Step 2: Sum each group
  const colMap = buildColMap(monthlyData);
  const revenue = sumRows(colMap, REVENUE_ROWS, windowCols);
  const totalCogs = sumRows(colMap, COGS_ROWS, windowCols);
  const ownerDl = sumRows(colMap, OWNER_DL_ROWS, windowCols);
  const employeeDl = sumRows(colMap, EMPLOYEE_DL_ROWS, windowCols);
  const totalDl = ownerDl + employeeDl;
  const totalMarketing = sumRows(colMap, MARKETING_ROWS, windowCols);
  const ownerMgmt = sumRows(colMap, OWNER_MGMT_ROWS, windowCols);
  const totalRent = sumRows(colMap, RENT_ROWS, windowCols);
  const totalInsurance = sumRows(colMap, INSURANCE_ROWS, windowCols);
  const totalSoftware = sumRows(colMap, SOFTWARE_ROWS, windowCols);
  const totalPayrollTax = sumRows(colMap, PAYROLL_TAX_ROWS, windowCols);
  const totalOtherOpex = sumRows(colMap, OTHER_OPEX_ROWS, windowCols);
  const totalOpex = sumRows(colMap, ALL_OPEX_ROWS, windowCols);
  const interestIncome = sumRows(colMap, [INTEREST_ROW], windowCols);

  // Step 3: Waterfall
  const grossMargin = revenue - totalCogs;
  const gmPct = safeDivide(grossMargin, revenue);
  const contributionMargin = grossMargin - totalDl;
  const cmPct = safeDivide(contributionMargin, revenue);
  const pretaxNetIncome = contributionMargin - totalMarketing - totalOpex;
  const pretaxPct = safeDivide(pretaxNetIncome, revenue);
  const ownerPayTotal = ownerDl + ownerMgmt;
  const truePretaxProfit = pretaxNetIncome + ownerPayTotal;
  const truePretaxPct = safeDivide(truePretaxProfit, revenue);
  const taxRate = monthlyData.tax_rate;
  const estimatedTax = truePretaxProfit > 0 ? truePretaxProfit * taxRate : 0;
  const postTaxCashFlow = truePretaxProfit - estimatedTax;

  // Step 4: Ratios
  const directLpr = safeDivide(grossMargin, totalDl);
  const mpr = safeDivide(grossMargin, totalMarketing);
  const manpr = safeDivide(contributionMargin, totalOpex);

  // Step 5: Scores
  const dlScore = lprScore(directLpr);
  const mpScore = mprScore(mpr);
  const mnScore = manprScore(manpr);
  const ptScore = pretaxScore(pretaxPct);
  const profitScore = dlScore + mpScore + mnScore + ptScore;
  const profitTier = getProfitTier(pretaxPct);

  // Step 6: Monthly breakdown
  const windowMonthObjs = [];
  for (let i = startIdx; i <= endIdx; i++) windowMonthObjs.push(months[i]);
  const monthlyBreakdown = windowMonthObjs.map((mo) => calcSingleMonth(colMap, mo));

  // Count months with data
  const monthsWithData = windowMonthObjs.filter((m) => m.has_data).length;

  // iferror flags
  const iferrorFlags = {
    gm_pct: revenue === 0,
    cm_pct: revenue === 0,
    direct_lpr: totalDl === 0,
    mpr: totalMarketing === 0,
    manpr: totalOpex === 0,
    pretax_pct: revenue === 0,
  };

  return {
    window: {
      end_year: endYM.year,
      end_month: endYM.month,
      end_label: `${MONTH_NAMES[endYM.month - 1]} ${endYM.year}`,
      start_year: startYM.year,
      start_month: startYM.month,
      start_label: `${MONTH_NAMES[startYM.month - 1]} ${startYM.year}`,
      actual_months: actualMonths,
      months_with_data: monthsWithData,
    },
    waterfall: {
      revenue, total_cogs: totalCogs, gross_margin: grossMargin, gm_pct: gmPct,
      total_dl: totalDl, owner_dl: ownerDl, employee_dl: employeeDl,
      direct_lpr: directLpr,
      contribution_margin: contributionMargin, cm_pct: cmPct,
      total_marketing: totalMarketing, mpr,
      owner_mgmt: ownerMgmt, total_rent: totalRent, total_insurance: totalInsurance,
      total_software: totalSoftware, total_payroll_tax: totalPayrollTax,
      total_other_opex: totalOtherOpex, total_opex: totalOpex,
      manpr,
      pretax_net_income: pretaxNetIncome, pretax_pct: pretaxPct,
      owner_pay_total: ownerPayTotal, true_pretax_profit: truePretaxProfit,
      true_pretax_pct: truePretaxPct,
      tax_rate: taxRate, estimated_tax: estimatedTax, post_tax_cash_flow: postTaxCashFlow,
      interest_income: interestIncome,
    },
    scores: {
      direct_lpr_score: dlScore,
      mpr_score: mpScore,
      manpr_score: mnScore,
      pretax_score: ptScore,
      profit_score: profitScore,
      profit_tier: profitTier,
    },
    monthly_breakdown: monthlyBreakdown,
    iferror_flags: iferrorFlags,
  };
}

// ── All-windows calculation (cached) ───────────────────────
export function calculateAllWindows(monthlyData) {
  if (_cachedAllWindows) return _cachedAllWindows;
  if (!monthlyData) return null;

  const windows = getAvailableWindows(monthlyData);
  // Sort oldest to newest for trend display
  const sorted = [...windows].sort((a, b) => a._end_idx - b._end_idx);

  const results = [];
  const trend = {
    labels: [], profit_scores: [], direct_lpr: [],
    mpr: [], manpr: [], pretax_pct: [], revenue: [],
  };

  for (const w of sorted) {
    if (!w.has_any_data) continue;
    const r = calculateRolling12(monthlyData, w.end_year, w.end_month);
    if (!r) continue;
    results.push(r);
    trend.labels.push(r.window.end_label);
    trend.profit_scores.push(r.scores.profit_score);
    trend.direct_lpr.push(r.waterfall.direct_lpr);
    trend.mpr.push(r.waterfall.mpr);
    trend.manpr.push(r.waterfall.manpr);
    trend.pretax_pct.push(r.waterfall.pretax_pct);
    trend.revenue.push(r.waterfall.revenue);
  }

  _cachedAllWindows = { results, trend };
  return _cachedAllWindows;
}

export { REVENUE_ROWS, COGS_ROWS, TOTAL_DL_ROWS, MARKETING_ROWS, ALL_OPEX_ROWS };
