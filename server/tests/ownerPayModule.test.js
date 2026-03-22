import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectOwnerPay, calculateSplit, getDefaultSplit } from '../integrations/ownerPayModule.js';

// ── calculateSplit ──────────────────────────────────────────────

describe('calculateSplit', () => {
  it('splits 100000 at 50% evenly', () => {
    const result = calculateSplit(100000, 0.5);
    assert.deepStrictEqual(result, {
      owner_direct_labor: 50000,
      owner_management_wage: 50000,
    });
  });

  it('splits 100000 at 30%', () => {
    const result = calculateSplit(100000, 0.3);
    assert.deepStrictEqual(result, {
      owner_direct_labor: 30000,
      owner_management_wage: 70000,
    });
  });

  it('odd total (100001 at 50%) sums to exactly 100001', () => {
    const result = calculateSplit(100001, 0.5);
    assert.strictEqual(
      result.owner_direct_labor + result.owner_management_wage,
      100001,
    );
  });

  it('zero total returns zero for both', () => {
    const result = calculateSplit(0, 0.5);
    assert.deepStrictEqual(result, {
      owner_direct_labor: 0,
      owner_management_wage: 0,
    });
  });

  it('100% direct labor puts everything in direct labor', () => {
    const result = calculateSplit(80000, 1.0);
    assert.strictEqual(result.owner_direct_labor, 80000);
    assert.strictEqual(result.owner_management_wage, 0);
  });

  it('0% direct labor puts everything in management', () => {
    const result = calculateSplit(80000, 0.0);
    assert.strictEqual(result.owner_direct_labor, 0);
    assert.strictEqual(result.owner_management_wage, 80000);
  });

  it('always sums to totalOwnerPay for many percentages', () => {
    for (let pct = 0; pct <= 100; pct += 5) {
      const result = calculateSplit(123457, pct / 100);
      assert.strictEqual(
        result.owner_direct_labor + result.owner_management_wage,
        123457,
        `Failed at ${pct}%`,
      );
    }
  });
});

// ── getDefaultSplit ─────────────────────────────────────────────

describe('getDefaultSplit', () => {
  it('returns 0.70 for solo_service', () => {
    assert.strictEqual(getDefaultSplit('solo_service'), 0.70);
  });

  it('returns 0.50 for small_team', () => {
    assert.strictEqual(getDefaultSplit('small_team'), 0.50);
  });

  it('returns 0.30 for larger_team', () => {
    assert.strictEqual(getDefaultSplit('larger_team'), 0.30);
  });

  it('returns 0.40 for retail_product', () => {
    assert.strictEqual(getDefaultSplit('retail_product'), 0.40);
  });

  it('returns 0.50 for unknown', () => {
    assert.strictEqual(getDefaultSplit('unknown'), 0.50);
  });

  it('returns 0.50 for unrecognized business types', () => {
    assert.strictEqual(getDefaultSplit('space_tourism'), 0.50);
  });
});

// ── detectOwnerPay ──────────────────────────────────────────────

describe('detectOwnerPay', () => {
  it('detects Officer Compensation in OpEx', () => {
    const qboData = {
      Rows: {
        Row: [
          {
            Header: { ColData: [{ value: 'Expenses' }] },
            Rows: {
              Row: [
                {
                  ColData: [
                    { value: 'Officer Compensation' },
                    { value: '85000' },
                  ],
                },
              ],
            },
            Summary: { ColData: [{ value: 'Total Expenses' }, { value: '120000' }] },
          },
        ],
      },
    };

    const result = detectOwnerPay(qboData);
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.amount, 85000);
    assert.strictEqual(result.source, 'Officer Compensation');
    assert.ok(result.confidence > 0);
  });

  it('detects Owner Salary', () => {
    const qboData = {
      Rows: {
        Row: [
          {
            Header: { ColData: [{ value: 'Operating Expenses' }] },
            Rows: {
              Row: [
                { ColData: [{ value: 'Owner Salary' }, { value: '72000' }] },
              ],
            },
            Summary: { ColData: [{ value: 'Total Operating Expenses' }, { value: '100000' }] },
          },
        ],
      },
    };

    const result = detectOwnerPay(qboData);
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.amount, 72000);
    assert.strictEqual(result.source, 'Owner Salary');
  });

  it('detects Guaranteed Payments', () => {
    const qboData = {
      Rows: {
        Row: [
          {
            Header: { ColData: [{ value: 'Expenses' }] },
            Rows: {
              Row: [
                { ColData: [{ value: 'Guaranteed Payments to Partners' }, { value: '60000' }] },
              ],
            },
            Summary: { ColData: [{ value: 'Total Expenses' }, { value: '90000' }] },
          },
        ],
      },
    };

    const result = detectOwnerPay(qboData);
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.amount, 60000);
    assert.strictEqual(result.source, 'Guaranteed Payments');
  });

  it('returns detected: false when no owner pay fields exist', () => {
    const qboData = {
      Rows: {
        Row: [
          {
            Header: { ColData: [{ value: 'Expenses' }] },
            Rows: {
              Row: [
                { ColData: [{ value: 'Rent' }, { value: '24000' }] },
                { ColData: [{ value: 'Utilities' }, { value: '3600' }] },
              ],
            },
            Summary: { ColData: [{ value: 'Total Expenses' }, { value: '27600' }] },
          },
        ],
      },
    };

    const result = detectOwnerPay(qboData);
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.amount, 0);
  });

  it('returns detected: false for null/empty input', () => {
    assert.strictEqual(detectOwnerPay(null).detected, false);
    assert.strictEqual(detectOwnerPay({}).detected, false);
    assert.strictEqual(detectOwnerPay({ Rows: {} }).detected, false);
  });

  it('prefers expense-section match over COGS-section match', () => {
    const qboData = {
      Rows: {
        Row: [
          {
            Header: { ColData: [{ value: 'Cost of Goods Sold' }] },
            Rows: {
              Row: [
                { ColData: [{ value: 'Owner Salary' }, { value: '40000' }] },
              ],
            },
            Summary: { ColData: [{ value: 'Total COGS' }, { value: '40000' }] },
          },
          {
            Header: { ColData: [{ value: 'Operating Expenses' }] },
            Rows: {
              Row: [
                { ColData: [{ value: 'Officer Compensation' }, { value: '90000' }] },
              ],
            },
            Summary: { ColData: [{ value: 'Total Expenses' }, { value: '90000' }] },
          },
        ],
      },
    };

    const result = detectOwnerPay(qboData);
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.amount, 90000);
    assert.strictEqual(result.source, 'Officer Compensation');
  });
});
