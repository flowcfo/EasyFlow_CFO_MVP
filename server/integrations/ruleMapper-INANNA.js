/**
 * Rule-based account name → Easy Numbers field (Excel + QBO confirmation helpers).
 */

function matchField(name) {
  const n = String(name || '').toLowerCase();
  if (!n.trim()) return null;
  if (/cost of goods|cogs|materials|direct cost/i.test(n)) return 'cogs';
  if (/marketing|advertis/i.test(n)) return 'marketing';
  if (/^rent\b|lease/i.test(n) || (/\brent\b/i.test(n) && !/parent/i.test(n))) return 'rent';
  if (/insurance/i.test(n)) return 'insurance';
  if (/software|subscription|saas/i.test(n)) return 'software_subscriptions';
  if (/subcontract|1099/i.test(n)) return 'subcontractors';
  if (
    /wage|payroll|labor|staff|crew|field|employee/i.test(n) &&
    !/owner|draw|officer|management/i.test(n)
  ) {
    return 'employee_direct_labor';
  }
  if (/owner|draw|guaranteed|officer|management wage/i.test(n)) return 'owner_management_wage';
  if (/revenue|sales|service|income|product/i.test(n) && !/expense|cost of|cogs/i.test(n)) {
    return 'revenue';
  }
  return null;
}

export function mapAccounts(accounts) {
  const matched = [];
  const unmatched = [];
  for (const acct of accounts || []) {
    const field = matchField(acct.name);
    if (field) {
      matched.push({
        ...acct,
        suggested_field: field,
        source: 'rule',
      });
    } else {
      unmatched.push(acct);
    }
  }
  return { matched, unmatched };
}
