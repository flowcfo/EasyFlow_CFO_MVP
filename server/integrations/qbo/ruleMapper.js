/**
 * QBO Rule Mapper
 *
 * Deterministic lookup table. No AI. No network calls.
 * Maps QBO ProfitAndLoss accounts to Easy Numbers fields by name + section.
 *
 * CRITICAL RULES:
 *   - Labor NEVER goes in cogs. If name contains labor/wages/payroll in COGS section,
 *     route to employee_direct_labor or subcontractors.
 *   - Owner pay in both COGS and Expenses: use Expenses only, flag COGS as duplicate.
 *   - Expense/OtherExpense accounts with no name match default to other_opex.
 *     No AI call needed.
 *   - Negative income: flagged, not included in revenue.
 *   - Subtotal rows: skipped entirely.
 */

// ── Parse QBO ProfitAndLoss report into flat account list ──────────

export function parseQBOReport(report) {
  const accounts = [];
  const rows = report?.Rows?.Row;
  if (!Array.isArray(rows)) return accounts;

  function walk(rowList, section) {
    if (!Array.isArray(rowList)) return;

    for (const row of rowList) {
      const headerLabel = row.Header?.ColData?.[0]?.value || '';
      const rowType = row.type || '';

      let childSection = section;
      const sectionLabel = headerLabel || row.group || '';
      const hasChildren = !!(row.Rows?.Row || row.Summary);
      const isSection = rowType === 'Section' || (hasChildren && sectionLabel);

      if (isSection && sectionLabel) {
        const hl = sectionLabel.toLowerCase();
        if (hl.includes('income') && !hl.includes('net income')) childSection = 'Income';
        if (hl.includes('cost of goods') || hl === 'cogs' || hl.includes('cost of sales')) childSection = 'CostOfGoodsSold';
        if (hl.includes('expense') && !hl.includes('other expense') && !hl.includes('cost')) childSection = 'Expenses';
        if (hl.includes('other expense')) childSection = 'OtherExpenses';
        if (hl.includes('other income')) childSection = 'OtherIncome';
        if (hl.includes('net income') || hl.includes('net operating')) childSection = 'NetIncome';
      }

      const isSubtotal = rowType === 'Total' || rowType === 'GrandTotal';

      if (row.ColData && Array.isArray(row.ColData) && row.ColData.length >= 2) {
        const name = (row.ColData[0]?.value || '').trim();
        const rawVal = row.ColData[1]?.value;
        let amount = 0;
        if (rawVal != null && rawVal !== '' && rawVal !== '---') {
          const parsed = parseFloat(String(rawVal).replace(/[$,]/g, ''));
          if (!isNaN(parsed)) amount = parsed;
        }

        if (name && childSection !== 'NetIncome') {
          accounts.push({
            name,
            type: childSection === 'Income' || childSection === 'OtherIncome' ? 'Income'
              : childSection === 'CostOfGoodsSold' ? 'CostOfGoodsSold'
              : childSection === 'OtherExpenses' ? 'OtherExpense'
              : 'Expense',
            section: childSection || 'Unknown',
            amount,
            is_subtotal: isSubtotal,
          });
        }
      }

      if (row.Rows?.Row) {
        walk(row.Rows.Row, childSection);
      }

      if (row.Summary?.ColData) {
        const name = (row.Summary.ColData[0]?.value || '').trim();
        const rawVal = row.Summary.ColData[1]?.value;
        let amount = 0;
        if (rawVal != null && rawVal !== '' && rawVal !== '---') {
          const parsed = parseFloat(String(rawVal).replace(/[$,]/g, ''));
          if (!isNaN(parsed)) amount = parsed;
        }
        if (name) {
          accounts.push({
            name,
            type: childSection === 'Income' || childSection === 'OtherIncome' ? 'Income' : 'Expense',
            section: childSection || 'Unknown',
            amount,
            is_subtotal: true,
          });
        }
      }
    }
  }

  walk(rows, '');
  return accounts;
}

// ── Lookup table ───────────────────────────────────────────────────

function norm(s) { return s.toLowerCase().trim(); }

const REVENUE_NAMES = new Set([
  'services revenue', 'service revenue', 'service income', 'services income',
  'sales', 'sales income', 'sales of product income', 'sales of products',
  'product revenue', 'product income', 'product sales',
  'consulting revenue', 'consulting income',
  'consulting services', 'professional services revenue', 'professional fees income',
  'project revenue', 'project income', 'job revenue', 'job income',
  'cleaning revenue', 'cleaning income', 'recurring revenue', 'maintenance revenue',
  'subscription revenue', 'retainer revenue', 'contract revenue', 'maintenance contracts',
  'workshops', 'workshop income', 'training revenue', 'training income',
  'speaking fees', 'coaching revenue', 'coaching income',
  'total revenue', 'gross revenue', 'gross sales', 'total sales', 'total income',
  'design income', 'design revenue', 'design services',
  'installation income', 'installation revenue', 'installation services',
  'repair income', 'repair revenue', 'repair services',
  'construction income', 'construction revenue', 'construction services',
  'landscaping income', 'landscaping revenue', 'landscaping services',
  'lawn care', 'lawn care services', 'lawn maintenance',
  'hardscaping', 'hardscaping services', 'irrigation', 'irrigation services',
  'tree services', 'tree removal', 'snow removal', 'snow plowing',
  'plumbing services', 'plumbing income', 'electrical services', 'electrical income',
  'hvac services', 'hvac income', 'roofing services', 'painting services',
  'remodeling services', 'renovation services', 'pressure washing', 'power washing',
  'window cleaning', 'pest control services', 'fence installation',
  'concrete services', 'patio services', 'deck services', 'deck building',
  'unapplied cash payment income',
].map(norm));

const REVENUE_FLAGGED_NAMES = new Set([
  'reimbursed expenses', 'reimbursements', 'pass-through', 'pass through',
  'billable expense income', 'billable expenses reimbursed',
  'insurance reimbursement', 'expense reimbursement',
].map(norm));

const COGS_NAMES = new Set([
  'materials', 'material costs', 'materials & supplies', 'materials and supplies',
  'job materials', 'project materials',
  'supplies', 'supply costs', 'job supplies', 'project supplies',
  'parts', 'part costs', 'equipment',
  'inventory', 'cost of inventory', 'products purchased for resale',
  'cost of goods sold', 'cost of sales', 'cost of services',
  'direct materials', 'raw materials', 'merchandise',
  'delivery costs', 'shipping', 'freight',
  'merchant fees', 'processing fees', 'transaction fees',
  'plants', 'plants and materials', 'plant materials',
  'mulch', 'stone', 'gravel', 'pavers', 'lumber', 'decking materials',
  'hardware', 'fasteners', 'seed and sod', 'fertilizer', 'chemicals',
  'soil', 'topsoil', 'sand', 'aggregate',
  'dumpster', 'disposal fees', 'dump fees',
  'tools and equipment', 'tools & small equipment', 'small tools',
  'tool purchases', 'equipment rental', 'equipment purchases', 'equipment costs',
  'fuel', 'gas', 'mileage',
  'permits and inspections',
].map(norm));

const SUB_NAMES = new Set([
  'subcontractors', 'subcontractor expenses', 'subcontractor labor', 'contract labor',
  'outside labor', '1099 labor', 'independent contractors',
  'contracted services', 'subcontracted work', 'contract work', 'outsourced labor',
  'subcontractor', 'subcontractor expense', 'subcontractor expenses',
  'subcontractors expense', 'subs', 'sub labor',
].map(norm));

const EMPLOYEE_LABOR_NAMES = new Set([
  'direct labor', 'field labor', 'production labor', 'billable labor',
  'technician labor', 'crew labor', 'staff labor',
  'cleaning staff labor', 'field employee wages',
  'installation labor', 'service labor', 'job labor',
  'wages - direct', 'salaries - direct', 'payroll - direct',
  'payroll', 'payroll expense', 'payroll expenses',
  'payroll & wages', 'payroll and wages',
  'wages', 'salaries', 'salary expense',
  'salaries and wages', 'wages and salaries',
  'employee wages', 'employee salaries', 'employee compensation',
  'crew wages', 'technician wages', 'staff wages', 'gross wages',
  'employee benefits', 'benefits', 'health insurance', 'health benefits',
  'medical insurance', 'dental insurance', 'vision insurance',
  'retirement', 'retirement plan', '401k', '401(k)', '401k match',
  'pension', 'simple ira', 'sep ira',
  'payroll tax', 'payroll taxes', 'employer taxes',
  'fica', 'fica expense', 'futa', 'suta',
  'state unemployment', 'federal unemployment',
  'workers comp', 'workers compensation', "worker's compensation", 'workers comp insurance',
  'payroll processing', 'payroll service', 'payroll processing fees',
  'pto', 'paid time off', 'vacation pay',
  'bonus', 'bonuses', 'commissions expense', 'commission expense',
].map(norm));

const OWNER_PAY_NAMES = new Set([
  'officer compensation', 'officer salary', 'officer wages',
  'owner compensation', 'owner salary', 'owner wages', 'owner draw',
  'guaranteed payments', 'guaranteed payments to partners',
  'partner compensation', 'member compensation',
  's-corp owner wages', 'shareholder wages',
  'officers compensation', "officer's compensation",
  'owner pay', "owner's salary", "owner's compensation", "owner's draw",
  'owners draw', 'owners salary',
  'member draw', 'member salary', 'member distribution',
  'shareholder salary', 'shareholder compensation',
  'executive compensation', 'management salary', 'management wage',
].map(norm));

const MARKETING_NAMES = new Set([
  'advertising', 'advertising expense', 'ads',
  'advertising & marketing', 'advertising and marketing',
  'marketing', 'marketing expense', 'marketing costs',
  'social media', 'social media advertising', 'social media marketing',
  'facebook ads', 'google ads', 'instagram ads', 'linkedin ads',
  'digital marketing', 'online advertising', 'paid media',
  'seo', 'search engine optimization', 'content marketing',
  'email marketing', 'print advertising', 'direct mail',
  'sponsorships', 'events', 'trade shows', 'exhibitions',
  'promotional materials', 'branding',
  'marketing agency', 'public relations', 'pr expense',
  'video production', 'photography',
  'lead generation', 'referral fees',
  'yard signs', 'lawn signs', 'job signs',
  'vehicle wrap', 'vehicle wraps', 'uniforms',
  'signage', 'business cards', 'website', 'website development', 'website maintenance',
].map(norm));

const RENT_NAMES = new Set([
  'rent', 'rent expense', 'office rent', 'shop rent', 'warehouse rent',
  'rent & facilities', 'rent and facilities',
  'lease', 'lease expense', 'equipment lease',
  'facilities', 'facility costs', 'space rental',
  'storage', 'storage fees', 'co-working space',
  'building rent', 'building lease', 'office space',
  'coworking', 'co-working', 'yard rent', 'shop lease',
  'occupancy', 'occupancy cost', 'occupancy costs',
  'vehicle lease',
].map(norm));

const INSURANCE_NAMES = new Set([
  'insurance', 'insurance expense', 'business insurance',
  'general liability', 'gl insurance', 'liability insurance',
  'workers compensation', 'workers comp', 'wc insurance',
  'commercial auto insurance', 'vehicle insurance',
  'professional liability', 'e&o insurance', 'errors and omissions',
  'property insurance', 'bop insurance',
  'auto insurance', 'umbrella insurance', 'umbrella',
  'bonding', 'surety bond', 'surety bonds',
  'cyber insurance', 'keyman insurance', 'key man insurance',
  'general liability insurance', 'commercial insurance',
].map(norm));

const SOFTWARE_NAMES = new Set([
  'software', 'software expense', 'software subscriptions',
  'subscriptions', 'subscription expense', 'saas',
  'cloud services', 'online services', 'technology',
  'computer expense', 'apps', 'application fees',
  'crm', 'accounting software', 'project management software',
  'communication tools', 'productivity software',
  'software & subscriptions', 'software and subscriptions',
  'subscription expenses', 'technology expense',
  'computer expenses', 'computer & internet',
  'hosting', 'web hosting', 'it services', 'it expense', 'it expenses',
  'internet', 'internet expense', 'internet service',
  'domain', 'domain expense',
  'quickbooks', 'xero', 'slack', 'zoom',
  'microsoft 365', 'google workspace',
  'app subscriptions',
].map(norm));

// Keywords that indicate labor even if the account is in the COGS section
const LABOR_KEYWORDS = /\b(labor|labour|wages|payroll|salary|salaries|compensation|employee|worker|crew|staff|technician)\b/i;
const SUB_KEYWORDS = /\b(subcontract|1099|contract\s+labor|outside\s+labor|independent\s+contractor|outsourc)/i;
const OWNER_KEYWORDS = /\b(officer|owner|guaranteed\s+payment|partner\s+comp|member\s+comp|shareholder|s.corp\s+owner)/i;

// ── Main mapper ────────────────────────────────────────────────────

export function ruleMap(parsedAccounts) {
  const result = {
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
    owner_pay_detected: 0,
    owner_pay_source: 'not_found',
  };

  const mappedAccounts = [];
  const unmatched = [];
  const flagged = [];
  let ownerPayInCOGS = null;
  let ownerPayInExpenses = null;

  for (const acct of parsedAccounts) {
    if (acct.is_subtotal) continue;

    const n = norm(acct.name);
    const section = acct.section || '';
    const amount = acct.amount || 0;
    const isIncome = section === 'Income' || section === 'OtherIncome';
    const isCOGS = section === 'CostOfGoodsSold';
    const isExpense = section === 'Expenses' || section === 'OtherExpenses';

    // ── REVENUE FLAGGED (passthrough) ──
    if (REVENUE_FLAGGED_NAMES.has(n)) {
      flagged.push({ name: acct.name, type: acct.type, amount, reason: 'possible_passthrough' });
      mappedAccounts.push({ ...acct, field: 'revenue_flagged', confidence: 1.0, source: 'rule' });
      continue;
    }

    // ── NEGATIVE INCOME ──
    if (isIncome && amount < 0) {
      flagged.push({ name: acct.name, type: acct.type, amount, reason: 'negative_income' });
      mappedAccounts.push({ ...acct, field: 'revenue_flagged', confidence: 1.0, source: 'rule' });
      continue;
    }

    // ── OWNER PAY (detect in any section) ──
    if (OWNER_PAY_NAMES.has(n) || OWNER_KEYWORDS.test(acct.name)) {
      if (isCOGS) {
        ownerPayInCOGS = { name: acct.name, type: acct.type, amount };
      } else {
        ownerPayInExpenses = { name: acct.name, type: acct.type, amount };
        result.owner_pay_detected += amount;
        const src = n.includes('officer') ? 'officer_compensation'
          : n.includes('guaranteed') ? 'guaranteed_payments'
          : n.includes('owner') ? 'owner_salary'
          : 'owner_salary';
        result.owner_pay_source = src;
        mappedAccounts.push({ ...acct, field: 'owner_pay_detected', confidence: 1.0, source: 'rule' });
      }
      continue;
    }

    // ── LABOR IN COGS SECTION (reroute) ──
    if (isCOGS && LABOR_KEYWORDS.test(acct.name)) {
      if (SUB_KEYWORDS.test(acct.name) || SUB_NAMES.has(n)) {
        result.subcontractors += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'subcontractors', confidence: 0.95, source: 'rule' });
      } else {
        result.employee_direct_labor += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'employee_direct_labor', confidence: 0.95, source: 'rule' });
      }
      continue;
    }

    // ── REVENUE ──
    if (isIncome) {
      if (REVENUE_NAMES.has(n)) {
        result.revenue += amount;
        mappedAccounts.push({ ...acct, field: 'revenue', confidence: 1.0, source: 'rule' });
      } else if (n === 'other income') {
        result.revenue += amount;
        mappedAccounts.push({ ...acct, field: 'revenue', confidence: 0.85, source: 'rule' });
      } else {
        unmatched.push(acct);
      }
      continue;
    }

    // ── COGS (materials only) ──
    if (isCOGS) {
      if (COGS_NAMES.has(n)) {
        result.cogs += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'cogs', confidence: 1.0, source: 'rule' });
      } else if (SUB_NAMES.has(n)) {
        result.subcontractors += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'subcontractors', confidence: 1.0, source: 'rule' });
      } else {
        unmatched.push(acct);
      }
      continue;
    }

    // ── EXPENSE / OTHER EXPENSE SECTION ──
    if (isExpense) {
      if (SUB_NAMES.has(n) || SUB_KEYWORDS.test(acct.name)) {
        result.subcontractors += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'subcontractors', confidence: 1.0, source: 'rule' });
      } else if (EMPLOYEE_LABOR_NAMES.has(n)) {
        result.employee_direct_labor += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'employee_direct_labor', confidence: 1.0, source: 'rule' });
      } else if (MARKETING_NAMES.has(n)) {
        result.marketing += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'marketing', confidence: 1.0, source: 'rule' });
      } else if (RENT_NAMES.has(n)) {
        result.rent += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'rent', confidence: 1.0, source: 'rule' });
      } else if (INSURANCE_NAMES.has(n)) {
        result.insurance += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'insurance', confidence: 1.0, source: 'rule' });
      } else if (SOFTWARE_NAMES.has(n)) {
        result.software_subscriptions += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'software_subscriptions', confidence: 1.0, source: 'rule' });
      } else {
        // Expense with no name match → other_opex. No AI call.
        result.other_opex += Math.abs(amount);
        mappedAccounts.push({ ...acct, field: 'other_opex', confidence: 0.80, source: 'rule' });
      }
      continue;
    }

    // ── UNKNOWN SECTION ──
    unmatched.push(acct);
  }

  // ── Owner pay duplicate resolution (Rule 3) ──
  if (ownerPayInCOGS && ownerPayInExpenses) {
    flagged.push({
      name: ownerPayInCOGS.name,
      type: ownerPayInCOGS.type,
      amount: ownerPayInCOGS.amount,
      reason: 'owner_pay_duplicate',
    });
  } else if (ownerPayInCOGS && !ownerPayInExpenses) {
    result.owner_pay_detected += ownerPayInCOGS.amount;
    result.owner_pay_source = 'owner_salary';
    mappedAccounts.push({
      ...ownerPayInCOGS,
      section: 'CostOfGoodsSold',
      field: 'owner_pay_detected',
      confidence: 0.85,
      source: 'rule',
    });
  }

  return {
    mapped: result,
    mappedAccounts,
    unmatched,
    flagged,
  };
}
