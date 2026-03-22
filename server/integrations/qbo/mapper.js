/**
 * QBO → Easy Numbers Mapper — Orchestrator
 *
 * Chains three files:
 *   1. ruleMapper.js  — deterministic lookup table
 *   2. aiClassifier.js — Claude Haiku for unmatched Income/COGS accounts
 *   3. confirmationBuilder.js — builds the owner confirmation screen data
 *
 * Also exports the legacy mapQBOToInputs for backward compatibility
 * with demo pull routes and existing code paths.
 */

import { parseQBOReport, ruleMap } from './ruleMapper.js';
import { aiClassify } from './aiClassifier.js';
import { buildConfirmation, finalizeInputs } from './confirmationBuilder.js';

/**
 * Full QBO mapping pipeline.
 * Returns confirmation data for the MappingConfirmation screen.
 *
 * @param {object} qboReport - QBO ProfitAndLoss report JSON
 * @param {string} businessType - e.g. 'construction', 'professional-services'
 * @returns {Promise<object>} confirmation screen data
 */
export async function mapQBOToEasyNumbers(qboReport, businessType) {
  // Step 1: Flatten QBO report into account list
  const parsedAccounts = parseQBOReport(qboReport);

  // Step 2: Rule-based mapping
  const ruleResult = ruleMap(parsedAccounts);

  // Step 3: AI classification (only for unmatched Income / COGS accounts)
  let aiResults = [];
  if (ruleResult.unmatched.length > 0) {
    aiResults = await aiClassify(ruleResult.unmatched, businessType);
  }

  // Step 4: Source total (sum of all non-subtotal accounts)
  const sourceTotal = parsedAccounts
    .filter((a) => !a.is_subtotal)
    .reduce((sum, a) => sum + Math.abs(a.amount || 0), 0);

  // Step 5: Build confirmation
  const confirmation = buildConfirmation(ruleResult, aiResults, sourceTotal);

  return confirmation;
}

/**
 * Legacy mapper — backward compatible with demo pull routes.
 * Produces the flat Easy Numbers input shape directly (no confirmation step).
 * Used by /integrations/demo/pull and /integrations/qbo/pull (old path).
 */
export function mapQBOToInputs(report) {
  const parsedAccounts = parseQBOReport(report);
  const ruleResult = ruleMap(parsedAccounts);

  const inputs = {
    revenue: ruleResult.mapped.revenue,
    cogs: ruleResult.mapped.cogs,
    employee_direct_labor: ruleResult.mapped.employee_direct_labor,
    subcontractors: ruleResult.mapped.subcontractors,
    marketing: ruleResult.mapped.marketing,
    rent: ruleResult.mapped.rent,
    insurance: ruleResult.mapped.insurance,
    software_subscriptions: ruleResult.mapped.software_subscriptions,
    other_opex: ruleResult.mapped.other_opex,
    owner_direct_labor: 0,
    owner_management_wage: 0,
    owner_market_wage_annual: 0,
    tax_rate: 0.40,
    core_capital_months: 2,
  };

  // Auto-split owner pay 50/50
  if (ruleResult.mapped.owner_pay_detected > 0) {
    const total = ruleResult.mapped.owner_pay_detected;
    inputs.owner_direct_labor = Math.floor(total / 2);
    inputs.owner_management_wage = total - inputs.owner_direct_labor;
  }

  const sources = {};
  for (const key of Object.keys(inputs)) {
    sources[key] = key === 'owner_direct_labor' || key === 'owner_management_wage'
      ? (ruleResult.mapped.owner_pay_detected > 0 ? 'estimated' : 'manual')
      : key === 'owner_market_wage_annual' || key === 'tax_rate' || key === 'core_capital_months'
        ? 'manual'
        : 'qbo';
  }

  return { inputs, sources };
}

/**
 * Generate synthetic monthly history from annual inputs for demo purposes.
 * Produces 24 months (2 years) of data with realistic seasonal variation.
 * This lets the forecast screen demonstrate trend analysis and rolling comparisons.
 */
export function generateDemoMonthlyHistory(inputs) {
  // Seasonal factors (home-services business: busier in spring/summer)
  const seasonal = [0.70, 0.72, 0.88, 1.02, 1.15, 1.22, 1.28, 1.25, 1.12, 0.95, 0.82, 0.75];
  const history = {};

  const fields = ['revenue', 'cogs', 'employee_direct_labor', 'subcontractors',
    'marketing', 'owner_management_wage', 'rent', 'insurance',
    'software_subscriptions', 'other_opex', 'owner_direct_labor'];

  // Generate 4 years: 2022 through 2025
  // Each year grows ~8-12% from the prior year
  const yearFactors = { 2022: 0.72, 2023: 0.80, 2024: 0.90, 2025: 1.0 };

  for (const [yearStr, yearFactor] of Object.entries(yearFactors)) {
    const year = parseInt(yearStr);

    for (let mo = 1; mo <= 12; mo++) {
      const key = `${year}-${String(mo).padStart(2, '0')}`;
      history[key] = {};

      const sf = seasonal[mo - 1];
      const jitter = () => 0.95 + Math.random() * 0.10;

      for (const f of fields) {
        const annual = inputs[f] || 0;
        const monthly = (annual / 12) * yearFactor;
        const isSeasonal = ['revenue', 'cogs', 'employee_direct_labor', 'subcontractors'].includes(f);
        history[key][f] = Math.round(monthly * (isSeasonal ? sf : 1.0) * jitter());
      }
    }
  }

  return history;
}
