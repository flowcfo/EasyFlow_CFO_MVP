import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseQBOReport, ruleMap } from '../integrations/qbo/ruleMapper.js';
import { aiClassify } from '../integrations/qbo/aiClassifier.js';
import { buildConfirmation, finalizeInputs } from '../integrations/qbo/confirmationBuilder.js';

// ── Helper: build a QBO Section row ─────────────────────────────

function makeSection(header, children, summaryAmount) {
  const row = {
    type: 'Section',
    Header: { ColData: [{ value: header }, { value: '' }] },
    Rows: { Row: children },
  };
  if (summaryAmount !== undefined) {
    row.Summary = { ColData: [{ value: `Total ${header}` }, { value: String(summaryAmount) }] };
  }
  return row;
}

function makeDataRow(name, amount) {
  return {
    type: 'Data',
    ColData: [{ value: name }, { value: String(amount) }],
  };
}

function makeTotalRow(name, amount) {
  return {
    type: 'Total',
    ColData: [{ value: name }, { value: String(amount) }],
  };
}

// ── parseQBOReport tests ────────────────────────────────────────

describe('parseQBOReport', () => {
  it('flattens a nested QBO report into account list', () => {
    const report = {
      Rows: {
        Row: [
          makeSection('Income', [
            makeDataRow('Services Revenue', 200000),
            makeDataRow('Product Sales', 50000),
          ], 250000),
          makeSection('Cost of Goods Sold', [
            makeDataRow('Materials', 30000),
          ], 30000),
          makeSection('Expenses', [
            makeDataRow('Advertising', 5000),
            makeDataRow('Rent', 12000),
          ], 17000),
        ],
      },
    };

    const accounts = parseQBOReport(report);
    const dataRows = accounts.filter((a) => !a.is_subtotal);
    assert.ok(dataRows.length >= 5);
    assert.ok(dataRows.some((a) => a.name === 'Services Revenue' && a.section === 'Income'));
    assert.ok(dataRows.some((a) => a.name === 'Materials' && a.section === 'CostOfGoodsSold'));
  });

  it('marks subtotals correctly', () => {
    const report = {
      Rows: {
        Row: [
          makeSection('Income', [
            makeDataRow('Sales', 100000),
            makeTotalRow('Total Income', 100000),
          ]),
        ],
      },
    };
    const accounts = parseQBOReport(report);
    const total = accounts.find((a) => a.name === 'Total Income');
    assert.ok(total);
    assert.strictEqual(total.is_subtotal, true);
  });

  it('handles blank and --- amounts as 0', () => {
    const report = {
      Rows: {
        Row: [
          makeSection('Income', [
            { type: 'Data', ColData: [{ value: 'Gift Cards' }, { value: '---' }] },
            { type: 'Data', ColData: [{ value: 'Tips' }, { value: '' }] },
          ]),
        ],
      },
    };
    const accounts = parseQBOReport(report);
    const dataRows = accounts.filter((a) => !a.is_subtotal);
    for (const r of dataRows) {
      assert.strictEqual(r.amount, 0);
    }
  });
});

// ── ruleMapper tests (1-10) ─────────────────────────────────────

describe('ruleMapper', () => {
  it('1. Services Revenue in Income → revenue', () => {
    const accounts = [{ name: 'Services Revenue', type: 'Income', section: 'Income', amount: 200000, is_subtotal: false }];
    const { mapped } = ruleMap(accounts);
    assert.strictEqual(mapped.revenue, 200000);
  });

  it('2. Contract Labor in COGS → subcontractors (not cogs)', () => {
    const accounts = [{ name: 'Contract Labor', type: 'CostOfGoodsSold', section: 'CostOfGoodsSold', amount: 35000, is_subtotal: false }];
    const { mapped } = ruleMap(accounts);
    assert.strictEqual(mapped.subcontractors, 35000);
    assert.strictEqual(mapped.cogs, 0);
  });

  it('3. Officer Compensation in Expenses → owner_pay_detected', () => {
    const accounts = [{ name: 'Officer Compensation', type: 'Expense', section: 'Expenses', amount: 85000, is_subtotal: false }];
    const { mapped } = ruleMap(accounts);
    assert.strictEqual(mapped.owner_pay_detected, 85000);
    assert.strictEqual(mapped.owner_pay_source, 'officer_compensation');
  });

  it('4. Advertising in Expenses → marketing', () => {
    const accounts = [{ name: 'Advertising', type: 'Expense', section: 'Expenses', amount: 12000, is_subtotal: false }];
    const { mapped } = ruleMap(accounts);
    assert.strictEqual(mapped.marketing, 12000);
  });

  it('5. Unknown Expense XYZ in Expenses → other_opex (no AI call)', () => {
    const accounts = [{ name: 'Unknown Expense XYZ', type: 'Expense', section: 'Expenses', amount: 3000, is_subtotal: false }];
    const { mapped, unmatched } = ruleMap(accounts);
    assert.strictEqual(mapped.other_opex, 3000);
    assert.strictEqual(unmatched.length, 0);
  });

  it('6. Reimbursed Expenses in Income → revenue_flagged in _flagged', () => {
    const accounts = [{ name: 'Reimbursed Expenses', type: 'Income', section: 'Income', amount: 5000, is_subtotal: false }];
    const { flagged } = ruleMap(accounts);
    assert.strictEqual(flagged.length, 1);
    assert.strictEqual(flagged[0].reason, 'possible_passthrough');
    assert.strictEqual(flagged[0].amount, 5000);
  });

  it('7. Subtotal row (is_subtotal true) → skipped, not mapped', () => {
    const accounts = [
      { name: 'Sales', type: 'Income', section: 'Income', amount: 100000, is_subtotal: false },
      { name: 'Total Income', type: 'Income', section: 'Income', amount: 100000, is_subtotal: true },
    ];
    const { mapped } = ruleMap(accounts);
    assert.strictEqual(mapped.revenue, 100000);
  });

  it('8. Multiple accounts mapping to same field → values summed', () => {
    const accounts = [
      { name: 'Advertising', type: 'Expense', section: 'Expenses', amount: 5000, is_subtotal: false },
      { name: 'Marketing', type: 'Expense', section: 'Expenses', amount: 8000, is_subtotal: false },
      { name: 'Social Media', type: 'Expense', section: 'Expenses', amount: 3000, is_subtotal: false },
    ];
    const { mapped } = ruleMap(accounts);
    assert.strictEqual(mapped.marketing, 16000);
  });

  it('9. Owner pay in both COGS and Expenses → Expenses used, COGS flagged', () => {
    const accounts = [
      { name: 'Owner Salary', type: 'CostOfGoodsSold', section: 'CostOfGoodsSold', amount: 40000, is_subtotal: false },
      { name: 'Officer Compensation', type: 'Expense', section: 'Expenses', amount: 90000, is_subtotal: false },
    ];
    const { mapped, flagged } = ruleMap(accounts);
    assert.strictEqual(mapped.owner_pay_detected, 90000);
    assert.strictEqual(flagged.length, 1);
    assert.strictEqual(flagged[0].reason, 'owner_pay_duplicate');
    assert.strictEqual(flagged[0].amount, 40000);
  });

  it('10. Negative income → flagged, not in revenue', () => {
    const accounts = [
      { name: 'Services Revenue', type: 'Income', section: 'Income', amount: 200000, is_subtotal: false },
      { name: 'Refund', type: 'Income', section: 'Income', amount: -3000, is_subtotal: false },
    ];
    const { mapped, flagged } = ruleMap(accounts);
    assert.strictEqual(mapped.revenue, 200000);
    const neg = flagged.find((f) => f.reason === 'negative_income');
    assert.ok(neg);
    assert.strictEqual(neg.amount, -3000);
  });
});

// ── aiClassifier tests (11-14) ──────────────────────────────────

describe('aiClassifier', () => {
  it('11. Empty unmatched array → returns empty array, no API call', async () => {
    const result = await aiClassify([], 'construction');
    assert.deepStrictEqual(result, []);
  });

  it('12. Fallback returns all accounts with field and confidence', async () => {
    const oldKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const accounts = [
        { name: 'Custom Widget Service', section: 'Income', amount: 50000 },
        { name: 'Special Materials', section: 'CostOfGoodsSold', amount: 10000 },
      ];
      const result = await aiClassify(accounts, 'construction');
      assert.strictEqual(result.length, 2);
      assert.ok(result[0].suggested_field);
      assert.ok(typeof result[0].confidence === 'number');
    } finally {
      if (oldKey) process.env.ANTHROPIC_API_KEY = oldKey;
    }
  });

  it('13. No API key → fallback returns other_opex/revenue/cogs with confidence 0.5-0.6', async () => {
    const oldKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const accounts = [
        { name: 'Mysterious Income', section: 'Income', amount: 5000 },
      ];
      const result = await aiClassify(accounts, 'unknown');
      assert.strictEqual(result[0].suggested_field, 'revenue');
      assert.strictEqual(result[0].confidence, 0.6);
    } finally {
      if (oldKey) process.env.ANTHROPIC_API_KEY = oldKey;
    }
  });

  it('14. Business type is present in fallback output', async () => {
    const oldKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await aiClassify(
        [{ name: 'Test', section: 'Income', amount: 1000 }],
        'landscaping'
      );
      assert.strictEqual(result.length, 1);
    } finally {
      if (oldKey) process.env.ANTHROPIC_API_KEY = oldKey;
    }
  });
});

// ── confirmationBuilder tests (15-20) ───────────────────────────

describe('confirmationBuilder', () => {
  function makeRuleResult(accounts, flagged = []) {
    return {
      mapped: {
        revenue: 0, cogs: 0, owner_direct_labor: 0, employee_direct_labor: 0,
        subcontractors: 0, marketing: 0, owner_management_wage: 0,
        rent: 0, insurance: 0, software_subscriptions: 0, other_opex: 0,
        owner_pay_detected: 0, owner_pay_source: 'not_found',
      },
      mappedAccounts: accounts,
      unmatched: [],
      flagged,
    };
  }

  it('15. Account with confidence 0.9 → auto_confirmed', () => {
    const result = buildConfirmation(
      makeRuleResult([{ name: 'Sales', field: 'revenue', amount: 100000, confidence: 0.9, source: 'rule' }]),
      [],
      100000,
    );
    assert.strictEqual(result.auto_confirmed.length, 1);
    assert.strictEqual(result.needs_review.length, 0);
    assert.strictEqual(result.requires_decision.length, 0);
  });

  it('16. Account with confidence 0.7 → needs_review', () => {
    const result = buildConfirmation(
      makeRuleResult([{ name: 'Misc Income', field: 'revenue', amount: 5000, confidence: 0.7, source: 'rule' }]),
      [],
      5000,
    );
    assert.strictEqual(result.auto_confirmed.length, 0);
    assert.strictEqual(result.needs_review.length, 1);
    assert.ok(result.needs_review[0].all_fields.length > 0);
  });

  it('17. Account with confidence 0.5 and amount 500 → requires_decision', () => {
    const result = buildConfirmation(
      makeRuleResult([{ name: 'Unknown', field: 'other_opex', amount: 500, confidence: 0.5, source: 'rule' }]),
      [],
      500,
    );
    assert.strictEqual(result.requires_decision.length, 1);
    assert.strictEqual(result.requires_decision[0].tier, 'requires_decision');
  });

  it('18. Account with confidence 0.5 and amount 1500 → hard_block', () => {
    const result = buildConfirmation(
      makeRuleResult([{ name: 'Big Unknown', field: 'other_opex', amount: 1500, confidence: 0.5, source: 'rule' }]),
      [],
      1500,
    );
    assert.strictEqual(result.requires_decision.length, 1);
    assert.strictEqual(result.requires_decision[0].tier, 'hard_block');
  });

  it('19. coverage_pct below 0.95 → show_warning true', () => {
    const result = buildConfirmation(
      makeRuleResult([{ name: 'Sales', field: 'revenue', amount: 80000, confidence: 1.0, source: 'rule' }]),
      [],
      100000,
    );
    assert.ok(result.coverage.coverage_pct < 0.95);
    assert.strictEqual(result.coverage.show_warning, true);
  });

  it('20. finalizeInputs sanitizes NaN/undefined to 0', () => {
    const confirmed = [
      { name: 'Sales', field: 'revenue', amount: 100000, confidence: 1.0 },
      { name: 'Bad', field: 'cogs', amount: NaN, confidence: 1.0 },
    ];
    const result = finalizeInputs(confirmed, 0, 'not_found');
    assert.strictEqual(result.revenue, 100000);
    assert.strictEqual(typeof result.cogs, 'number');
    assert.ok(!isNaN(result.cogs));
    assert.ok(!isNaN(result.other_opex));
    for (const key of Object.keys(result)) {
      if (typeof result[key] === 'number') {
        assert.ok(!isNaN(result[key]), `${key} should not be NaN`);
      }
    }
  });
});
