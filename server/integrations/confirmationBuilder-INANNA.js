import { INPUT_FIELDS, INPUT_SHAPE } from '../../shared/schema.js';

export function buildConfirmation(matched, aiClassified, accounts) {
  return {
    matched_count: matched.length,
    ai_count: aiClassified.length,
    account_count: accounts?.length ?? 0,
    lines: [...matched, ...aiClassified],
  };
}

export function finalizeMappings(allMappings) {
  const inputs = {};
  const sources = {};
  for (const k of INPUT_FIELDS) {
    inputs[k] = INPUT_SHAPE[k].default;
    sources[k] = 'manual';
  }
  for (const m of allMappings || []) {
    const field = m.suggested_field || m.field;
    if (!field || field === 'skip' || field === 'revenue_flagged') continue;
    if (inputs[field] === undefined) continue;
    inputs[field] = (inputs[field] || 0) + Math.abs(Number(m.amount) || 0);
    sources[field] = m.source || 'excel';
  }
  return { inputs, sources };
}
