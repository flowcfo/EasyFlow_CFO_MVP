import { getDefaultInputs } from '../../../shared/schema.js';

export function buildConfirmation(ruleResult, aiResults, sourceTotal) {
  return {
    provider: 'qbo',
    source_total: sourceTotal,
    mapped: ruleResult.mapped,
    unmatched: ruleResult.unmatched,
    ai_classifications: aiResults,
  };
}

/**
 * Owner-confirmed rows from the mapping UI → Easy Numbers input object.
 */
export function finalizeInputs(confirmedMappings, ownerPayDetected = 0, _ownerPaySource = 'not_found') {
  const inputs = getDefaultInputs();
  for (const row of confirmedMappings || []) {
    const field = row.suggested_field || row.field || row.easy_field;
    if (!field || field === 'skip') continue;
    if (inputs[field] === undefined) continue;
    inputs[field] = (inputs[field] || 0) + Number(row.amount || 0);
  }
  const pay = ownerPayDetected > 0 ? ownerPayDetected : 0;
  if (pay > 0) {
    inputs.owner_direct_labor = Math.floor(pay / 2);
    inputs.owner_management_wage = pay - inputs.owner_direct_labor;
  }
  return inputs;
}
