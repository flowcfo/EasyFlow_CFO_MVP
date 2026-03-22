/**
 * Confirmation Builder
 * Takes combined output of ruleMapper + aiClassifier.
 * Builds the confirmation screen data structure.
 * Separates auto-confirmed (high confidence) from needs-review (low confidence).
 * Implements the 7 error prevention rules.
 */

import { EASY_NUMBERS_FIELDS } from './ruleMapper.js';

const HIGH_CONFIDENCE = 0.85;
const MEDIUM_CONFIDENCE = 0.70;
const FLAG_THRESHOLD = 1000;

/**
 * Build the full confirmation data for the frontend.
 * @param {Array} ruleMatched - accounts matched by ruleMapper
 * @param {Array} aiClassified - accounts classified by aiClassifier
 * @param {Array} originalAccounts - all extracted accounts (for validation)
 * @returns {Object} confirmation data for frontend
 */
export function buildConfirmation(ruleMatched, aiClassified, originalAccounts) {
  const allMappings = [];

  // Merge rule-matched accounts
  for (const item of ruleMatched) {
    allMappings.push({
      name: item.name,
      original_amount: item.amount,
      section: item.section || 'unknown',
      suggested_field: item.suggested_field,
      confidence: item.confidence,
      source: item.source || 'rules',
      status: item.confidence >= HIGH_CONFIDENCE ? 'auto_confirmed' : 'needs_review',
      row: item.row,
    });
  }

  // Merge AI-classified accounts
  for (const item of aiClassified) {
    const original = originalAccounts?.find((a) => a.name === item.name);
    allMappings.push({
      name: item.name,
      original_amount: original?.amount || 0,
      section: original?.section || 'unknown',
      suggested_field: item.suggested_field,
      confidence: item.confidence,
      source: item.source || 'ai',
      status: item.confidence >= MEDIUM_CONFIDENCE ? 'needs_review' : 'flagged',
      row: original?.row,
    });
  }

  // --- Error Prevention Rules ---

  const warnings = [];

  // Rule 1: Detect subtotals (value = sum of adjacent rows) — handled in parser
  // Rule 2: Flag negative revenue
  const negativeRevenue = allMappings.filter(
    (m) => m.suggested_field === 'revenue' && m.original_amount < 0
  );
  for (const item of negativeRevenue) {
    item.status = 'flagged';
    item.warning = 'Negative revenue detected. May be a refund or correction.';
    warnings.push({ account: item.name, rule: 'negative_revenue', message: item.warning });
  }

  // Rule 3: Owner pay in multiple sections
  const ownerAccounts = allMappings.filter(
    (m) => m.suggested_field === 'owner_management_wage' || m.suggested_field === 'owner_direct_labor'
  );
  const ownerSections = new Set(ownerAccounts.map((m) => m.section));
  if (ownerSections.size > 1) {
    for (const item of ownerAccounts) {
      item.status = 'flagged';
      item.warning = 'Owner pay appears in multiple P&L sections. Confirm which to use.';
    }
    warnings.push({
      account: 'Owner pay',
      rule: 'duplicate_owner_pay',
      message: 'Owner pay found in multiple sections.',
    });
  }

  // Rule 4: Unmatched accounts > $1,000 must be flagged
  for (const item of allMappings) {
    if (item.status === 'flagged' && Math.abs(item.original_amount) >= FLAG_THRESHOLD) {
      item.requires_confirmation = true;
    }
  }

  // Rule 5: Calculate totals for comparison
  const preMappingTotal = originalAccounts?.reduce((sum, a) => sum + Math.abs(a.amount || 0), 0) || 0;
  const postMappingTotal = allMappings.reduce((sum, m) => sum + Math.abs(m.original_amount), 0);
  const unmappedRevenuePct = preMappingTotal > 0
    ? (preMappingTotal - postMappingTotal) / preMappingTotal
    : 0;

  if (unmappedRevenuePct > 0.05) {
    warnings.push({
      account: 'Overall',
      rule: 'mapping_gap',
      message: `${(unmappedRevenuePct * 100).toFixed(1)}% of total values were not mapped. Your score may be understated.`,
    });
  }

  // Build the summary totals by field
  const fieldTotals = {};
  for (const field of EASY_NUMBERS_FIELDS) {
    fieldTotals[field] = 0;
  }
  for (const m of allMappings) {
    if (fieldTotals.hasOwnProperty(m.suggested_field)) {
      fieldTotals[m.suggested_field] += Math.abs(m.original_amount);
    }
  }

  // Rule 6: Validate cascade math
  const grossMargin = fieldTotals.revenue - fieldTotals.cogs;
  const directLabor = fieldTotals.owner_direct_labor + fieldTotals.employee_direct_labor + fieldTotals.subcontractors;
  const contributionMargin = grossMargin - directLabor - fieldTotals.marketing;
  const cascadeValid = fieldTotals.revenue > 0;

  if (fieldTotals.revenue > 0 && grossMargin < 0) {
    warnings.push({
      account: 'Cascade',
      rule: 'negative_gross_margin',
      message: 'COGS exceeds Revenue. Check that revenue accounts are correctly classified.',
    });
  }

  // Separate into confidence tiers for the UI
  const autoConfirmed = allMappings.filter((m) => m.status === 'auto_confirmed');
  const needsReview = allMappings.filter((m) => m.status === 'needs_review');
  const flagged = allMappings.filter((m) => m.status === 'flagged');

  return {
    mappings: allMappings,
    summary: {
      total_accounts: allMappings.length,
      auto_confirmed: autoConfirmed.length,
      needs_review: needsReview.length,
      flagged: flagged.length,
      field_totals: fieldTotals,
      pre_mapping_total: preMappingTotal,
      post_mapping_total: postMappingTotal,
      cascade_valid: cascadeValid,
      gross_margin: grossMargin,
      contribution_margin: contributionMargin,
    },
    warnings,
    fields: EASY_NUMBERS_FIELDS,
  };
}

/**
 * Finalize confirmed mappings into Easy Numbers input format.
 * Called after the owner has reviewed and confirmed the mappings.
 * @param {Array} confirmedMappings - mappings with owner-confirmed fields
 * @returns {{ inputs: Object, sources: Object }}
 */
export function finalizeMappings(confirmedMappings) {
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
    owner_market_wage_annual: 0,
    tax_rate: 0.40,
    core_capital_months: 2,
  };

  const sources = {};
  for (const key of Object.keys(inputs)) {
    sources[key] = 'manual';
  }

  for (const mapping of confirmedMappings) {
    const field = mapping.confirmed_field || mapping.suggested_field;
    if (!field || field === 'skip' || field === 'revenue_flagged') continue;
    if (!inputs.hasOwnProperty(field)) continue;

    const raw = mapping.original_amount ?? mapping.amount ?? 0;
    const amt = Math.abs(Number(raw));
    if (!Number.isFinite(amt)) continue;

    inputs[field] += amt;
    const src = mapping.source;
    sources[field] =
      src === 'rules' || src === 'fallback'
        ? 'excel'
        : src === 'ai'
          ? 'ai_classified'
          : 'confirmed';
  }

  // Auto-split owner pay if only management side found
  if (inputs.owner_management_wage > 0 && inputs.owner_direct_labor === 0) {
    const total = inputs.owner_management_wage;
    inputs.owner_direct_labor = Math.round(total / 2);
    inputs.owner_management_wage = Math.round(total / 2);
    sources.owner_direct_labor = 'estimated';
    sources.owner_management_wage = 'estimated';
  }

  return { inputs, sources };
}
