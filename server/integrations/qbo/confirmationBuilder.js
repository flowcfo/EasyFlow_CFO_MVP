/**
 * QBO Confirmation Builder
 *
 * Takes rule-mapped + AI-classified accounts and produces the confirmation
 * screen data structure with three tiers:
 *   auto_confirmed  (>= 0.85)
 *   needs_review    (0.60 - 0.84)
 *   requires_decision (< 0.60, hard_block if amount > $1,000)
 *
 * Enforces the seven error prevention rules.
 */

const ALL_FIELDS = [
  'revenue', 'cogs', 'employee_direct_labor', 'subcontractors',
  'marketing', 'owner_pay_detected', 'owner_management_wage',
  'rent', 'insurance', 'software_subscriptions', 'other_opex', 'skip',
];

/**
 * Build the confirmation data for the frontend.
 *
 * @param {{ mapped: object, mappedAccounts: Array, unmatched: Array, flagged: Array }} ruleResult
 * @param {Array<{name: string, suggested_field: string, confidence: number}>} aiClassified
 * @param {number} sourceTotal - sum of all non-subtotal account amounts from QBO
 * @returns {object} confirmation screen data
 */
export function buildConfirmation(ruleResult, aiClassified, sourceTotal) {
  const auto_confirmed = [];
  const needs_review = [];
  const requires_decision = [];
  const flagged = [...(ruleResult.flagged || [])];

  // Process rule-mapped accounts
  for (const acct of ruleResult.mappedAccounts) {
    if (acct.field === 'revenue_flagged') continue;

    const entry = {
      name: acct.name,
      field: acct.field,
      amount: acct.amount,
      confidence: acct.confidence,
      source: 'rule',
    };

    if (acct.confidence >= 0.85) {
      auto_confirmed.push(entry);
    } else if (acct.confidence >= 0.60) {
      needs_review.push({
        ...entry,
        suggested_field: acct.field,
        all_fields: ALL_FIELDS,
      });
    } else {
      const tier = Math.abs(acct.amount) > 1000 ? 'hard_block' : 'requires_decision';
      requires_decision.push({
        ...entry,
        tier,
        all_fields: ALL_FIELDS,
      });
    }
  }

  // Process AI-classified accounts
  for (const ai of aiClassified) {
    const original = ruleResult.unmatched.find((u) => u.name === ai.name);
    const amount = original?.amount || 0;

    const entry = {
      name: ai.name,
      field: ai.suggested_field,
      amount,
      confidence: ai.confidence,
      source: 'ai',
    };

    if (ai.confidence >= 0.85) {
      auto_confirmed.push(entry);
    } else if (ai.confidence >= 0.60) {
      needs_review.push({
        ...entry,
        suggested_field: ai.suggested_field,
        all_fields: ALL_FIELDS,
      });
    } else {
      const tier = Math.abs(amount) > 1000 ? 'hard_block' : 'requires_decision';
      requires_decision.push({
        ...entry,
        tier,
        all_fields: ALL_FIELDS,
      });
    }
  }

  // Build preview from auto_confirmed accounts only
  const preview = {
    revenue: 0,
    cogs: 0,
    employee_direct_labor: 0,
    subcontractors: 0,
    marketing: 0,
    owner_pay_detected: 0,
    owner_management_wage: 0,
    rent: 0,
    insurance: 0,
    software_subscriptions: 0,
    other_opex: 0,
  };

  for (const acct of auto_confirmed) {
    if (preview.hasOwnProperty(acct.field)) {
      preview[acct.field] += Math.abs(acct.amount);
    }
  }

  // Preserve owner pay from rule mapper
  if (ruleResult.mapped.owner_pay_detected > 0) {
    preview.owner_pay_detected = ruleResult.mapped.owner_pay_detected;
  }

  // Coverage calculation (Rule 5)
  const mappedTotal =
    auto_confirmed.reduce((s, a) => s + Math.abs(a.amount), 0) +
    needs_review.reduce((s, a) => s + Math.abs(a.amount), 0) +
    requires_decision.reduce((s, a) => s + Math.abs(a.amount), 0) +
    flagged.reduce((s, a) => s + Math.abs(a.amount), 0);

  const coveragePct = sourceTotal > 0 ? mappedTotal / sourceTotal : 1;

  return {
    auto_confirmed,
    needs_review,
    requires_decision,
    flagged,
    preview,
    coverage: {
      mapped_total: mappedTotal,
      source_total: sourceTotal,
      coverage_pct: coveragePct,
      show_warning: coveragePct < 0.95,
    },
    owner_pay: {
      detected: ruleResult.mapped.owner_pay_detected,
      source: ruleResult.mapped.owner_pay_source,
    },
    all_fields: ALL_FIELDS,
  };
}

/**
 * Finalize confirmed mappings into Easy Numbers input shape.
 * Called after owner has reviewed and confirmed all items.
 *
 * @param {Array} allConfirmed - all accounts with final field assignments
 * @param {number} ownerPayDetected - total owner pay from detection
 * @param {string} ownerPaySource
 * @returns {object} Easy Numbers input shape
 */
export function finalizeInputs(allConfirmed, ownerPayDetected, ownerPaySource) {
  const inputs = {
    revenue: 0,
    cogs: 0,
    owner_direct_labor: 0,
    employee_direct_labor: 0,
    subcontractors: 0,
    marketing: 0,
    owner_management_wage: 0,
    rent: 0,
    insurance: 0,
    software_subscriptions: 0,
    other_opex: 0,
    owner_pay_detected: ownerPayDetected || 0,
    owner_pay_source: ownerPaySource || 'not_found',
    owner_market_wage_annual: 0,
    tax_rate: 0.40,
    core_capital_months: 2,
  };

  const unmapped = [];
  const _flagged = [];
  let mappingTotal = 0;

  for (const acct of allConfirmed) {
    const field = acct.confirmed_field || acct.field;
    const amount = Math.abs(acct.amount || 0);

    if (field === 'skip') continue;

    if (field === 'revenue') {
      inputs.revenue += acct.amount || 0;
    } else if (field === 'owner_pay_detected') {
      // Already tracked separately
    } else if (inputs.hasOwnProperty(field)) {
      inputs[field] += amount;
    } else {
      unmapped.push({ name: acct.name, type: acct.type || '', amount, confidence: acct.confidence || 0 });
    }

    mappingTotal += amount;
  }

  // Rule 7: sanitize all fields
  for (const key of Object.keys(inputs)) {
    if (typeof inputs[key] === 'number' && (isNaN(inputs[key]) || inputs[key] === null || inputs[key] === undefined)) {
      inputs[key] = 0;
    }
  }

  inputs._unmapped = unmapped;
  inputs._flagged = _flagged;
  inputs._mapping_total = mappingTotal;

  return inputs;
}
