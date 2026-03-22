/**
 * Owner Pay Module
 *
 * Owner pay in Easy Numbers splits into two P&L rows that always sum
 * to the owner's total annual pay:
 *   Row 23 — Owner Direct Labor (billable work)
 *   Row 42 — Owner Management Wage (running the business)
 */

const OWNER_PAY_KEYWORDS = [
  { pattern: /officer\s*(comp|salary|wage)/i, source: 'Officer Compensation' },
  { pattern: /officer'?s?\s*(comp|salary|wage)/i, source: 'Officer Compensation' },
  { pattern: /owner\s*(salary|wage|pay|comp|draw)/i, source: 'Owner Salary' },
  { pattern: /owner'?s?\s*(salary|wage|pay|comp|draw)/i, source: 'Owner Salary' },
  { pattern: /guaranteed\s*payment/i, source: 'Guaranteed Payments' },
  { pattern: /member\s*(draw|salary|comp|distribution)/i, source: 'Member Draw' },
  { pattern: /shareholder\s*(salary|comp|wage)/i, source: 'Shareholder Compensation' },
  { pattern: /executive\s*comp/i, source: 'Executive Compensation' },
];

const SPLIT_DEFAULTS = {
  solo_service: 0.70,
  small_team: 0.50,
  larger_team: 0.30,
  retail_product: 0.40,
  unknown: 0.50,
};

/**
 * Search a QBO ProfitAndLoss report for owner pay.
 * Walks the nested Row/ColData tree and checks expense sections first,
 * then falls back to COGS sections.
 *
 * @param {Object} qboData - QBO ProfitAndLoss report JSON
 * @returns {{ detected: boolean, amount: number, source: string, confidence: number }}
 */
export function detectOwnerPay(qboData) {
  const rows = qboData?.Rows?.Row;
  if (!rows || !Array.isArray(rows)) {
    return { detected: false, amount: 0, source: '', confidence: 0 };
  }

  const candidates = [];

  function walkRows(rowList, sectionLabel) {
    if (!Array.isArray(rowList)) return;

    for (const row of rowList) {
      const label = (
        row.ColData?.[0]?.value ||
        row.Header?.ColData?.[0]?.value ||
        ''
      );

      const value =
        parseFloat(row.Summary?.ColData?.[1]?.value) ||
        parseFloat(row.ColData?.[1]?.value) ||
        0;

      for (const kw of OWNER_PAY_KEYWORDS) {
        if (kw.pattern.test(label) && value !== 0) {
          const isExpenseSection = /expense|operating/i.test(sectionLabel);
          candidates.push({
            amount: Math.abs(value),
            source: kw.source,
            label,
            confidence: isExpenseSection ? 0.95 : 0.75,
            section: sectionLabel,
          });
        }
      }

      const childSection =
        row.Header?.ColData?.[0]?.value || row.group || sectionLabel;

      if (row.Rows?.Row) {
        walkRows(row.Rows.Row, childSection);
      }
    }
  }

  walkRows(rows, '');

  if (candidates.length === 0) {
    return { detected: false, amount: 0, source: '', confidence: 0 };
  }

  candidates.sort((a, b) => b.confidence - a.confidence || b.amount - a.amount);
  const best = candidates[0];

  return {
    detected: true,
    amount: best.amount,
    source: best.source,
    confidence: best.confidence,
  };
}

/**
 * Split total owner pay into direct labor and management wage.
 * Uses floor + subtraction so the two values sum to totalOwnerPay exactly.
 *
 * @param {number} totalOwnerPay
 * @param {number} directLaborPct - 0.0 to 1.0
 * @returns {{ owner_direct_labor: number, owner_management_wage: number }}
 */
export function calculateSplit(totalOwnerPay, directLaborPct) {
  const clamped = Math.max(0, Math.min(1, directLaborPct));
  const directLabor = Math.floor(totalOwnerPay * clamped);
  const managementWage = totalOwnerPay - directLabor;
  return {
    owner_direct_labor: directLabor,
    owner_management_wage: managementWage,
  };
}

/**
 * Return a sensible default direct-labor percentage for the business type.
 *
 * @param {string} businessType
 * @returns {number} directLaborPct (0.0 to 1.0)
 */
export function getDefaultSplit(businessType) {
  return SPLIT_DEFAULTS[businessType] ?? SPLIT_DEFAULTS.unknown;
}
