/**
 * Excel/CSV Structure Detector and Account Extractor — v2
 *
 * Handles real QBO P&L exports where:
 *   - Labels may be in ANY column (A, B, C...), not just column 0
 *   - Indentation is done via columns rather than spaces
 *   - The only numeric column is named "Total"
 *   - Section headers like "Ordinary Income/Expense" wrap across rows
 *   - Company name and report title occupy the first 3-5 rows
 *
 * Pipeline: extractAccounts → mapAccounts → classifyAccounts → buildConfirmation
 */

import XLSX from 'xlsx';
import { mapAccounts } from '../ruleMapper.js';
import { classifyAccounts } from '../aiClassifier.js';
import { buildConfirmation, finalizeMappings } from '../confirmationBuilder.js';

// --- Section detection ---
const SECTION_PATTERNS = {
  income: [
    /^income$/i, /^revenue$/i,
    /^ordinary income/i, /^operating income/i, /^gross income/i,
    /^service revenue$/i, /^other income$/i, /^non-operating income/i,
    /^income\s*\/\s*expense/i,
    /^ordinary income\s*\/\s*expense/i,
  ],
  cogs: [
    /^cost of goods/i, /^cogs$/i, /^cost of sales/i,
    /^cost of revenue/i, /^direct costs/i, /^cost of services/i,
  ],
  expenses: [
    /^expense/i, /^expenses$/i, /^operating expense/i, /^overhead/i,
    /^general.*admin/i, /^selling.*general/i, /^sg&?a/i,
    /^other expense/i, /^other expenses$/i,
  ],
};

function detectSection(label) {
  const lower = label.toLowerCase().trim();
  if (!lower || lower.length < 3) return null;
  for (const [section, patterns] of Object.entries(SECTION_PATTERNS)) {
    for (const pat of patterns) {
      if (pat.test(lower)) return section;
    }
  }
  return null;
}

function isTotalRow(label) {
  const lower = label.toLowerCase().trim();
  return /^total\s/i.test(lower) || /\btotal$/i.test(lower)
    || /^net\s(ordinary\s)?income/i.test(lower) || /^net\s(operating\s)?income/i.test(lower)
    || /^net profit/i.test(lower) || /^net loss/i.test(lower)
    || /^net other income/i.test(lower) || /^net other expense/i.test(lower)
    || /^gross profit/i.test(lower) || /^gross margin/i.test(lower)
    || /^ebitda/i.test(lower);
}

function isHeaderRow(text) {
  const lower = text.toLowerCase().trim();
  return /profit\s*(and|&)\s*loss/i.test(lower) || /p\s*&?\s*l\b/i.test(lower)
    || /^(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(lower)
    || /^\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(lower)
    || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s/i.test(lower)
    || /^accrual basis/i.test(lower) || /^cash basis/i.test(lower)
    || /^basis:\s/i.test(lower) || /^as of/i.test(lower)
    || /^date\s+range/i.test(lower);
}

function isNumeric(val) {
  if (val === null || val === undefined || val === '') return false;
  const cleaned = String(val).replace(/[$,()%]/g, '').trim();
  return cleaned.length > 0 && !isNaN(parseFloat(cleaned));
}

function parseNumber(val) {
  if (val === null || val === undefined) return 0;
  let str = String(val).replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const isNegative = str.startsWith('(') && str.endsWith(')');
  if (isNegative) str = str.slice(1, -1);
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

/** Month name → 1-12 */
const MONTH_LONG = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const MONTH_SHORT = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a column header like "September 2019", "Sep 2019", "Jan 2025".
 * Returns { year, month } or null if not a month column.
 */
export function parseMonthHeader(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (!s || s.length < 5) return null;

  // Skip obvious non-month headers
  if (/\btotal\b/i.test(s) && !/20\d{2}/.test(s)) return null;
  if (/distribution account/i.test(s)) return null;

  let m = s.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})$/i);
  if (m) {
    const month = MONTH_LONG[m[1].toLowerCase()];
    if (month) return { year: parseInt(m[2], 10), month };
  }

  m = s.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.\s]+(20\d{2})$/i);
  if (m) {
    const month = MONTH_SHORT[m[1].toLowerCase()];
    if (month) return { year: parseInt(m[2], 10), month };
  }

  // "Jan-25" or "Jan 25"
  m = s.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.\s-]+(\d{2})$/i);
  if (m) {
    const yy = parseInt(m[2], 10);
    const year = yy >= 50 ? 1900 + yy : 2000 + yy;
    const month = MONTH_SHORT[m[1].toLowerCase()];
    if (month) return { year, month };
  }

  // Numeric "1/2025" or "01/2025"
  m = s.match(/^(\d{1,2})\s*\/\s*(20\d{2})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    if (month >= 1 && month <= 12) return { year: parseInt(m[2], 10), month };
  }

  return null;
}

function isTotalColumnHeader(val) {
  if (val == null) return false;
  const s = String(val).trim().toLowerCase();
  return s === 'total' || s === 'grand total' || /^total\s/.test(s);
}

function monthSortKey({ year, month }) {
  return year * 12 + month;
}

/**
 * Find the row that has the most month-like headers (QBO puts month names in one row).
 */
function findMonthHeaderRow(grid, labelCol) {
  let bestRow = -1;
  let bestCount = 0;
  const scanRows = Math.min(25, grid.length);

  for (let r = 0; r < scanRows; r++) {
    let count = 0;
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (c === labelCol) continue;
      if (parseMonthHeader(row[c])) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestRow = r;
    }
  }

  return bestCount >= 2 ? bestRow : -1;
}

/**
 * All columns that look like month headers, sorted chronologically. Excludes Total.
 */
function discoverMonthColumns(grid, headerRow, labelCol) {
  const row = grid[headerRow];
  if (!row) return [];

  const found = [];
  for (let c = 0; c < row.length; c++) {
    if (c === labelCol) continue;
    const cell = row[c];
    if (isTotalColumnHeader(cell)) continue;
    const parsed = parseMonthHeader(cell);
    if (parsed) {
      found.push({
        col: c,
        year: parsed.year,
        month: parsed.month,
        key: monthSortKey(parsed),
        label: String(cell).trim(),
      });
    }
  }

  found.sort((a, b) => a.key - b.key);
  return found;
}

/** Keep the last N chronological month columns (default 12 = rolling TTM). */
function selectTrailingMonths(monthCols, maxMonths = 12) {
  if (monthCols.length === 0) return [];
  const n = Math.min(maxMonths, monthCols.length);
  return monthCols.slice(-n);
}

function sumRowAcrossColumns(row, monthCols) {
  let sum = 0;
  let hasAny = false;
  for (const { col } of monthCols) {
    const v = row[col];
    if (v != null && isNumeric(v)) {
      sum += parseNumber(v);
      hasAny = true;
    }
  }
  return { sum, hasAny };
}

function formatMonthRangeLabel(monthCols) {
  if (monthCols.length === 0) return '';
  const first = monthCols[0];
  const last = monthCols[monthCols.length - 1];
  const fm = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${fm[first.month - 1]} ${first.year} – ${fm[last.month - 1]} ${last.year}`;
}

// --- Convert sheet to 2D array for reliable scanning ---
function sheetToGrid(sheet) {
  const ref = sheet['!ref'];
  if (!ref) return { grid: [], range: { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } } };
  const range = XLSX.utils.decode_range(ref);
  const grid = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      row.push(cell ? cell.v : null);
    }
    grid.push(row);
  }
  return { grid, range };
}

// --- Find the label column and value column(s) ---
function analyzeColumns(grid) {
  if (grid.length === 0) return { labelCol: 0, valueCol: 1 };

  const colCount = grid[0]?.length || 0;
  const colStats = [];

  for (let c = 0; c < colCount; c++) {
    let textCount = 0;
    let numericCount = 0;
    let emptyCount = 0;
    let headerText = '';

    for (let r = 0; r < Math.min(5, grid.length); r++) {
      const val = grid[r][c];
      if (val != null && !isNumeric(val)) {
        headerText += ' ' + String(val).toLowerCase().trim();
      }
    }

    for (let r = 0; r < grid.length; r++) {
      const val = grid[r][c];
      if (val === null || val === undefined || String(val).trim() === '') {
        emptyCount++;
      } else if (isNumeric(val)) {
        numericCount++;
      } else {
        textCount++;
      }
    }

    const isTotal = /\btotal\b/i.test(headerText);
    let yearMatch = null;
    const yearPat = headerText.match(/\b(20\d{2})\b/);
    if (yearPat) yearMatch = parseInt(yearPat[1]);
    const hasTrailing12 = /trailing|ttm|rolling|last\s*12|l12m|ltm/i.test(headerText);

    colStats.push({ col: c, textCount, numericCount, emptyCount, headerText: headerText.trim(), isTotal, yearMatch, hasTrailing12 });
  }

  // Label column: the column with the most text content
  const textCols = colStats.filter((cs) => cs.textCount > 3);
  textCols.sort((a, b) => b.textCount - a.textCount);
  const labelCol = textCols.length > 0 ? textCols[0].col : 0;

  // Value column: prefer TTM, then Total (for multi-period), then recent year, then highest numeric count
  const numCols = colStats.filter((cs) => cs.numericCount > 2 && cs.col !== labelCol);

  if (numCols.length === 0) {
    const anyCols = colStats.filter((cs) => cs.numericCount > 0 && cs.col !== labelCol);
    if (anyCols.length > 0) {
      anyCols.sort((a, b) => b.numericCount - a.numericCount);
      return { labelCol, valueCol: anyCols[0].col, colStats, reason: 'sparse fallback' };
    }
    return { labelCol, valueCol: labelCol === 0 ? 1 : colCount - 1, colStats, reason: 'no numeric columns found' };
  }

  const now = new Date();
  const curYear = now.getFullYear();
  const lastYear = curYear - 1;

  // Multi-period detection: if there are many numeric columns (>6), this is a
  // multi-month report. Use the Total column for aggregate figures.
  const isMultiPeriod = numCols.length > 6;

  // Priority 1: Trailing 12 months
  const ttm = numCols.find((cs) => cs.hasTrailing12);
  if (ttm) return { labelCol, valueCol: ttm.col, colStats, reason: 'trailing 12 months' };

  // Priority 2: For multi-period reports, prefer the Total column (it has the most data)
  if (isMultiPeriod) {
    const totalCol = numCols.find((cs) => cs.isTotal);
    if (totalCol) return { labelCol, valueCol: totalCol.col, colStats, reason: 'total column (multi-period report)' };
    // If no Total column, use the column with the most numeric rows
    const bestCoverage = [...numCols].sort((a, b) => b.numericCount - a.numericCount);
    if (bestCoverage.length > 0) {
      return { labelCol, valueCol: bestCoverage[0].col, colStats, reason: 'best coverage column (multi-period)' };
    }
  }

  // Priority 3: Current year non-total
  const cur = numCols.find((cs) => cs.yearMatch === curYear && !cs.isTotal);
  if (cur) return { labelCol, valueCol: cur.col, colStats, reason: `${curYear}` };

  // Priority 4: Last year non-total
  const prev = numCols.find((cs) => cs.yearMatch === lastYear && !cs.isTotal);
  if (prev) return { labelCol, valueCol: prev.col, colStats, reason: `${lastYear}` };

  // Priority 5: Any year, most recent, non-total
  const yearCols = numCols.filter((cs) => cs.yearMatch && !cs.isTotal).sort((a, b) => b.yearMatch - a.yearMatch);
  if (yearCols.length > 0) return { labelCol, valueCol: yearCols[0].col, colStats, reason: `${yearCols[0].yearMatch}` };

  // Priority 6: Non-total column, rightmost
  const nonTotalNum = numCols.filter((cs) => !cs.isTotal);
  if (nonTotalNum.length > 0) {
    nonTotalNum.sort((a, b) => b.col - a.col);
    return { labelCol, valueCol: nonTotalNum[0].col, colStats, reason: 'most recent non-total column' };
  }

  // Priority 7: The "Total" column as last resort
  numCols.sort((a, b) => b.numericCount - a.numericCount);
  return { labelCol, valueCol: numCols[0].col, colStats, reason: numCols[0].isTotal ? 'total column (only option)' : 'best numeric column' };
}

// --- Get text from a row, collapsing all text cells into one label ---
function getRowLabel(row, labelCol) {
  // Primary: use the detected label column
  const primary = row[labelCol];
  if (primary != null && String(primary).trim()) {
    return String(primary).trim();
  }

  // Fallback: find the first non-empty text cell in the row
  for (let c = 0; c < row.length; c++) {
    const val = row[c];
    if (val != null && String(val).trim() && !isNumeric(val)) {
      return String(val).trim();
    }
  }

  return '';
}

// --- Subtotal detection (Rule 1) ---
function detectSubtotals(rows) {
  const flagged = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isTotalRow(row.label)) continue;

    let runningSum = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (isTotalRow(rows[j].label)) break;
      runningSum += rows[j].amount;
    }
    const diff = Math.abs(Math.abs(row.amount) - Math.abs(runningSum));
    if (diff < 1) {
      flagged.add(i);
    }
  }
  return flagged;
}

// --- Main extraction ---

/**
 * Extract all account line items from an Excel/CSV file.
 * Auto-detects label column and value column.
 * Returns raw accounts with section context for the mapping pipeline.
 */
export function extractAccounts(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const plSheetNames = workbook.SheetNames.filter((name) => {
    const lower = name.toLowerCase();
    return lower.includes('p&l') || lower.includes('p and l') || lower.includes('profit')
      || lower.includes('loss') || lower.includes('income') || lower.includes('input')
      || lower.includes('pl') || lower.includes('monthly');
  });

  const targetSheet = plSheetNames[0] || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheet];
  if (!sheet || !sheet['!ref']) {
    return { accounts: [], metadata: { error: 'Empty sheet' } };
  }

  const { grid, range } = sheetToGrid(sheet);
  const columnAnalysis = analyzeColumns(grid);
  const { labelCol, valueCol, reason: singleColReason } = columnAnalysis;

  // --- Monthly P&L: sum the last 12 month columns (rolling TTM), not lifetime Total ---
  const headerRow = findMonthHeaderRow(grid, labelCol);
  const allMonthCols = headerRow >= 0 ? discoverMonthColumns(grid, headerRow, labelCol) : [];
  const useMonthly = headerRow >= 0 && allMonthCols.length >= 2;

  let monthCols = [];
  let periodReason = singleColReason;
  let valueColUsed = valueCol;

  if (useMonthly) {
    monthCols = selectTrailingMonths(allMonthCols, 12);
    periodReason = `Last ${monthCols.length} months summed (${formatMonthRangeLabel(monthCols)})`;
    valueColUsed = monthCols.length ? monthCols[monthCols.length - 1].col : valueCol;
  }

  // First pass: extract all rows with label + value
  const rawRows = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    const label = getRowLabel(row, labelCol);
    if (!label) continue;

    // Skip report header rows (company name, date range, etc.)
    if (r < 5 && isHeaderRow(label)) continue;

    // Skip the month header row itself if it got picked up as data
    if (useMonthly && r === headerRow) continue;

    let amount;
    let hasValue;
    if (useMonthly && monthCols.length > 0) {
      const { sum, hasAny } = sumRowAcrossColumns(row, monthCols);
      amount = sum;
      hasValue = hasAny;
    } else {
      const rawVal = row[valueCol];
      hasValue = rawVal != null && isNumeric(rawVal);
      amount = hasValue ? parseNumber(rawVal) : 0;
    }

    rawRows.push({ row: r + 1, label, amount, hasValue });
  }

  // Detect subtotals
  const subtotalIndices = detectSubtotals(rawRows);

  // Second pass: assign sections and extract accounts
  let currentSection = null;
  const accounts = [];
  const debugRows = [];

  for (let i = 0; i < rawRows.length; i++) {
    const { row, label, amount, hasValue } = rawRows[i];

    // Check for section header — but only if the row has NO numeric value.
    // Rows like "Sales" that also carry dollar amounts are data, not headers.
    const sectionChange = detectSection(label);
    if (sectionChange && !hasValue) {
      currentSection = sectionChange;
      debugRows.push({ row, label, action: `section → ${sectionChange}` });
      continue;
    }
    if (sectionChange && hasValue) {
      // It matches a section pattern but also has data.
      // Treat it as a section change AND a data row.
      currentSection = sectionChange;
      debugRows.push({ row, label, action: `section → ${sectionChange} (also has data)` });
    }

    // Skip totals and subtotals
    if (isTotalRow(label)) {
      debugRows.push({ row, label, amount, action: 'skipped (total)' });
      continue;
    }
    if (subtotalIndices.has(i)) {
      debugRows.push({ row, label, amount, action: 'skipped (subtotal)' });
      continue;
    }

    // Skip rows with no value
    if (amount === 0 && !hasValue) {
      debugRows.push({ row, label, action: 'skipped (no value)' });
      continue;
    }

    // Per-month values for trend analysis (only when monthly mode is active)
    let monthly = null;
    if (useMonthly && allMonthCols.length > 0) {
      monthly = {};
      for (const mc of allMonthCols) {
        const v = grid[row - 1]?.[mc.col];
        const key = `${mc.year}-${String(mc.month).padStart(2, '0')}`;
        if (v != null && isNumeric(v)) {
          monthly[key] = parseNumber(v);
        }
      }
    }

    accounts.push({
      row,
      name: label,
      amount,
      section: currentSection || 'unknown',
      monthly,
    });
    debugRows.push({ row, label, amount, section: currentSection, action: 'extracted' });
  }

  return {
    accounts,
    metadata: {
      filename,
      sheet_used: targetSheet,
      total_sheets: workbook.SheetNames.length,
      sheet_names: workbook.SheetNames,
      period_selected: periodReason,
      monthly_mode: useMonthly,
      months_in_period: monthCols.length,
      month_range: useMonthly ? formatMonthRangeLabel(monthCols) : null,
      month_columns: useMonthly ? monthCols.map((m) => ({ col: m.col, label: m.label })) : null,
      all_months_count: allMonthCols.length,
      all_months_range: allMonthCols.length > 0
        ? `${allMonthCols[0].label} to ${allMonthCols[allMonthCols.length - 1].label}`
        : null,
      header_row: headerRow >= 0 ? headerRow + 1 : null,
      label_column: labelCol,
      value_column: valueColUsed,
      total_rows: rawRows.length,
      subtotals_excluded: subtotalIndices.size,
      accounts_extracted: accounts.length,
      debug_rows: debugRows.slice(0, 80),
    },
  };
}

/**
 * Full parse pipeline: extract → ruleMap → aiClassify → buildConfirmation.
 * Called by the /integrations/excel/upload endpoint.
 */
export async function parseExcelFile(buffer, filename, businessType) {
  const { accounts, metadata } = extractAccounts(buffer, filename);

  if (accounts.length === 0) {
    return {
      confirmation: null,
      inputs: null,
      metadata: { ...metadata, error: 'No accounts found in file' },
    };
  }

  // Step 1: Rule-based mapping
  const { matched, unmatched } = mapAccounts(accounts);

  // Step 2: AI classification for unmatched accounts
  let aiClassified = [];
  if (unmatched.length > 0) {
    aiClassified = await classifyAccounts(unmatched, businessType);
  }

  // Step 3: Build confirmation data
  const confirmation = buildConfirmation(matched, aiClassified, accounts);

  // Step 4: Also generate quick-finalized inputs (for users who skip confirmation)
  const allMappings = [...matched, ...aiClassified.map((ai) => {
    const original = accounts.find((a) => a.name === ai.name);
    return {
      name: ai.name,
      amount: original?.amount || 0,
      monthly: original?.monthly || null,
      suggested_field: ai.suggested_field,
      source: ai.source,
    };
  })];
  const { inputs, sources } = finalizeMappings(allMappings);

  // Step 5: Build monthly history by Easy Numbers field (for trend analysis)
  let monthlyHistory = null;
  if (metadata.monthly_mode) {
    monthlyHistory = buildMonthlyHistory(allMappings);
  }

  return {
    confirmation,
    inputs,
    sources,
    monthlyHistory,
    metadata: {
      ...metadata,
      matched_lines: matched.length + aiClassified.length,
      rule_matched: matched.length,
      ai_classified: aiClassified.length,
      total_unmatched: unmatched.length,
    },
  };
}

/**
 * Aggregate per-account monthly data into monthly totals by Easy Numbers field.
 * Returns: { '2024-01': { revenue: X, cogs: Y, ... }, '2024-02': ... }
 */
function buildMonthlyHistory(mappedAccounts) {
  const history = {};

  for (const acct of mappedAccounts) {
    const field = acct.suggested_field || acct.field;
    if (!field || field === 'skip' || field === 'revenue_flagged') continue;
    if (!acct.monthly) continue;

    for (const [monthKey, value] of Object.entries(acct.monthly)) {
      if (!history[monthKey]) {
        history[monthKey] = {
          revenue: 0, cogs: 0, employee_direct_labor: 0, subcontractors: 0,
          marketing: 0, owner_management_wage: 0, rent: 0, insurance: 0,
          software_subscriptions: 0, other_opex: 0, owner_pay_detected: 0,
          owner_direct_labor: 0,
        };
      }
      const useField = field === 'owner_pay_detected' ? 'owner_pay_detected' : field;
      if (history[monthKey][useField] !== undefined) {
        history[monthKey][useField] += (field === 'revenue' ? value : Math.abs(value));
      }
    }
  }

  return history;
}
