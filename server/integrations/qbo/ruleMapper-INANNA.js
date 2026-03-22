/**
 * QBO report → parsed accounts → Easy Numbers buckets (rule-based).
 */

function walkRows(rowList, section, out) {
  if (!Array.isArray(rowList)) return;
  for (const row of rowList) {
    const headerLabel = row.Header?.ColData?.[0]?.value || '';
    const label =
      row.ColData?.[0]?.value ||
      headerLabel ||
      row.Title ||
      '';
    const rawVal =
      row.ColData?.[1]?.value ??
      row.Summary?.ColData?.[1]?.value ??
      '0';
    const value = parseFloat(String(rawVal).replace(/,/g, '')) || 0;

    let childSection = section;
    const h = String(headerLabel || label).toLowerCase();
    if (h.includes('income') && !h.includes('expense')) childSection = 'income';
    else if (h.includes('cost of goods') || h.includes('cogs')) childSection = 'cogs';
    else if (h.includes('expense')) childSection = 'expenses';

    if (label && !row.Header && Math.abs(value) > 0 && !Number.isNaN(value)) {
      out.push({
        name: String(label).trim(),
        amount: Math.abs(value),
        section: childSection || 'unknown',
        is_subtotal: /^total\b/i.test(label) || /^net\b/i.test(label),
      });
    }

    if (row.Rows?.Row) {
      walkRows(row.Rows.Row, childSection || section, out);
    }
  }
}

export function parseQBOReport(qboReport) {
  const rows = qboReport?.Rows?.Row || [];
  const accounts = [];
  walkRows(rows, null, accounts);
  return accounts.filter((a) => !a.is_subtotal);
}

function classifyName(name) {
  const n = name.toLowerCase();
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
  if (/owner|draw|guaranteed|officer|management wage|payroll/i.test(n)) return 'owner_pay_detected';
  if (/revenue|sales|service|income|product/i.test(n) && !/expense|cost of|cogs/i.test(n)) {
    return 'revenue';
  }
  return null;
}

export function ruleMap(parsedAccounts) {
  const mapped = {
    revenue: 0,
    cogs: 0,
    employee_direct_labor: 0,
    subcontractors: 0,
    marketing: 0,
    rent: 0,
    insurance: 0,
    software_subscriptions: 0,
    other_opex: 0,
    owner_pay_detected: 0,
  };
  const unmatched = [];

  for (const acct of parsedAccounts) {
    const field = classifyName(acct.name);
    if (field === null) {
      mapped.other_opex += acct.amount;
    } else if (field === 'owner_pay_detected') {
      mapped.owner_pay_detected += acct.amount;
    } else {
      mapped[field] += acct.amount;
    }
  }

  return { mapped, unmatched };
}
