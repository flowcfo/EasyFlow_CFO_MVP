/**
 * Classify unmatched P&amp;L lines (Anthropic can be wired here later).
 */
export async function classifyAccounts(unmatched, _businessType) {
  if (!unmatched?.length) return [];
  return unmatched.map((a) => ({
    name: a.name,
    amount: a.amount,
    monthly: a.monthly,
    suggested_field: 'other_opex',
    source: 'fallback',
  }));
}
