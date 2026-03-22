/**
 * Calendar trailing-twelve-months (TTM): sums exactly 12 consecutive calendar months
 * ending at (endYear, endMonth). Missing months count as zero — important for seasonal /
 * partial-year businesses. YoY compares periods with the same calendar end month.
 */

export const TTM_SUM_FIELDS = [
  'revenue', 'cogs', 'employee_direct_labor', 'subcontractors',
  'marketing', 'owner_management_wage', 'rent', 'insurance',
  'software_subscriptions', 'other_opex', 'owner_direct_labor',
];

function monthIndex(year, month) {
  return year * 12 + month - 1;
}

function indexToYearMonth(idx) {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { year: y, month: m };
}

function keyFor(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Sum one P&L field across the 12 calendar months ending at (endYear, endMonth), inclusive.
 */
export function sumCalendarTTM(history, endYear, endMonth) {
  const totals = {};
  for (const f of TTM_SUM_FIELDS) totals[f] = 0;
  if (!history) return totals;

  const endIdx = monthIndex(endYear, endMonth);
  for (let i = 0; i < 12; i++) {
    const { year, month } = indexToYearMonth(endIdx - i);
    const k = keyFor(year, month);
    const row = history[k];
    if (!row) continue;
    for (const f of TTM_SUM_FIELDS) totals[f] += row[f] || 0;
  }
  return totals;
}

export function countMonthsWithRevenueInTTM(history, endYear, endMonth) {
  let n = 0;
  const endIdx = monthIndex(endYear, endMonth);
  for (let i = 0; i < 12; i++) {
    const { year, month } = indexToYearMonth(endIdx - i);
    const k = keyFor(year, month);
    const rev = history?.[k]?.revenue ?? 0;
    if (rev > 0) n++;
  }
  return n;
}

function safeDivide(a, b) {
  return b && b !== 0 ? a / b : 0;
}

/**
 * Build one period object (metrics) from trailing-12 calendar month sums.
 */
function periodFromTotals(totals, endKey, label) {
  const dl =
    totals.owner_direct_labor + totals.employee_direct_labor + totals.subcontractors;
  const gm = totals.revenue - totals.cogs;
  const cm = gm - dl;
  const opex =
    totals.owner_management_wage +
    totals.rent +
    totals.insurance +
    totals.software_subscriptions +
    totals.other_opex;
  const pretax = cm - totals.marketing - opex;

  return {
    label,
    end: endKey,
    revenue: Math.round(totals.revenue),
    gross_margin: Math.round(gm),
    contribution_margin: Math.round(cm),
    pretax: Math.round(pretax),
    pretax_pct: safeDivide(pretax, totals.revenue),
    marketing: Math.round(totals.marketing),
    direct_labor: Math.round(dl),
    opex: Math.round(opex),
  };
}

/**
 * Series of TTM periods — one row per month-end from first full calendar window through latest data month.
 */
export function buildCalendarRollingPeriods(history) {
  if (!history || Object.keys(history).length === 0) return [];

  const keys = Object.keys(history).sort();
  const [fy, fm] = keys[0].split('-').map(Number);
  const [ly, lm] = keys[keys.length - 1].split('-').map(Number);

  const firstEndIdx = monthIndex(fy, fm) + 11;
  const lastEndIdx = monthIndex(ly, lm);
  if (firstEndIdx > lastEndIdx) return [];

  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const periods = [];
  for (let endIdx = firstEndIdx; endIdx <= lastEndIdx; endIdx++) {
    const { year: ey, month: em } = indexToYearMonth(endIdx);
    const endKey = keyFor(ey, em);
    const totals = sumCalendarTTM(history, ey, em);
    const label = `${MONTH_NAMES[em - 1]} ${ey}`;
    periods.push({
      ...periodFromTotals(totals, endKey, label),
      months_with_revenue: countMonthsWithRevenueInTTM(history, ey, em),
    });
  }
  return periods;
}

/** `2024-06` → `2023-06` for YoY alignment */
export function priorYearEndKey(endKey) {
  const [y, m] = endKey.split('-').map(Number);
  return `${y - 1}-${String(m).padStart(2, '0')}`;
}

/** Oldest → newest month keys within the TTM ending at (endYear, endMonth). */
export function calendarTTMKeysChronological(endYear, endMonth) {
  const endIdx = monthIndex(endYear, endMonth);
  const keys = [];
  for (let i = 11; i >= 0; i--) {
    const { year, month } = indexToYearMonth(endIdx - i);
    keys.push(keyFor(year, month));
  }
  return keys;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Rolling-window picker entries — one per calendar TTM end from first valid through last month in data.
 */
export function listTTMWindowMetas(history) {
  if (!history || Object.keys(history).length === 0) return [];
  const keys = Object.keys(history).sort();
  const [fy, fm] = keys[0].split('-').map(Number);
  const [ly, lm] = keys[keys.length - 1].split('-').map(Number);
  const firstEndIdx = monthIndex(fy, fm) + 11;
  const lastEndIdx = monthIndex(ly, lm);
  if (firstEndIdx > lastEndIdx) return [];

  let lastDataIdx = -1;
  for (let i = keys.length - 1; i >= 0; i--) {
    const row = history[keys[i]];
    if (row && Object.values(row).some((v) => v > 0)) {
      lastDataIdx = i;
      break;
    }
  }
  const lastDataKey = lastDataIdx >= 0 ? keys[lastDataIdx] : keys[keys.length - 1];
  const [lastEy, lastEm] = lastDataKey.split('-').map(Number);
  const latestEndIdx = monthIndex(lastEy, lastEm);

  const windows = [];
  for (let endIdx = firstEndIdx; endIdx <= lastEndIdx; endIdx++) {
    const { year: ey, month: em } = indexToYearMonth(endIdx);
    const { year: sy, month: sm } = indexToYearMonth(endIdx - 11);
    const withData = countMonthsWithRevenueInTTM(history, ey, em);
    if (withData === 0) continue;

    windows.push({
      end_year: ey,
      end_month: em,
      end_label: `${MONTH_NAMES_SHORT[em - 1]} ${ey}${endIdx === latestEndIdx ? ' (TTM)' : ''}`,
      start_year: sy,
      start_month: sm,
      start_label: `${MONTH_NAMES_SHORT[sm - 1]} ${sy}`,
      months_in_window: 12,
      months_with_data: withData,
      data_coverage_pct: withData / 12,
      has_any_data: true,
      is_partial: false,
      is_latest: endIdx === latestEndIdx,
    });
  }

  return windows.reverse();
}
