import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { extractAccounts } from '../integrations/excel/parser.js';
import { mapAccounts } from '../integrations/ruleMapper.js';

function makeQBOBuffer(rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Profit and Loss');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('extractAccounts — QBO-style P&L', () => {
  it('extracts accounts from a standard QBO P&L with labels in column A and values in column B', () => {
    const buffer = makeQBOBuffer([
      ['Upper Deck Landscaping', ''],
      ['Profit and Loss', ''],
      ['January - December 2025', ''],
      ['', 'Total'],
      ['Income', ''],
      ['  Landscaping Services', 320000],
      ['  Design Income', 45000],
      ['  Maintenance Contracts', 85000],
      ['Total Income', 450000],
      ['Cost of Goods Sold', ''],
      ['  Materials & Supplies', 67500],
      ['  Equipment Rental', 22000],
      ['Total Cost of Goods Sold', 89500],
      ['Gross Profit', 360500],
      ['Expenses', ''],
      ['  Advertising', 12000],
      ['  Insurance', 8400],
      ['  Officer Compensation', 85000],
      ['  Payroll Expenses', 120000],
      ['  Subcontractors', 35000],
      ['  Rent', 24000],
      ['  Utilities', 6000],
      ['  Software & Subscriptions', 4800],
      ['  Truck Expense', 9600],
      ['  Professional Fees', 3500],
      ['Total Expenses', 308300],
      ['Net Income', 52200],
    ]);

    const { accounts, metadata } = extractAccounts(buffer, 'test.xlsx');

    assert.ok(accounts.length >= 10, `Expected 10+ accounts, got ${accounts.length}`);
    assert.ok(metadata.accounts_extracted >= 10);

    const names = accounts.map((a) => a.name.trim());
    assert.ok(names.some((n) => /landscaping/i.test(n)), 'Should find Landscaping Services');
    assert.ok(names.some((n) => /advertising/i.test(n)), 'Should find Advertising');
    assert.ok(names.some((n) => /officer/i.test(n)), 'Should find Officer Compensation');

    const incomeAccounts = accounts.filter((a) => a.section === 'income');
    assert.ok(incomeAccounts.length >= 2, `Expected 2+ income accounts, got ${incomeAccounts.length}`);

    const expenseAccounts = accounts.filter((a) => a.section === 'expenses');
    assert.ok(expenseAccounts.length >= 5, `Expected 5+ expense accounts, got ${expenseAccounts.length}`);
  });

  it('detects the value column even when it is labeled "Total"', () => {
    const buffer = makeQBOBuffer([
      ['Company Name', ''],
      ['Profit and Loss', ''],
      ['', 'Total'],
      ['Income', ''],
      ['  Sales', 100000],
      ['  Consulting', 50000],
      ['Total Income', 150000],
      ['Expenses', ''],
      ['  Rent', 12000],
      ['  Advertising', 5000],
      ['Total Expenses', 17000],
      ['Net Income', 133000],
    ]);

    const { accounts, metadata } = extractAccounts(buffer, 'test.xlsx');
    const names = accounts.map((a) => `${a.name}(${a.amount},${a.section})`);
    assert.ok(accounts.length >= 3, `Expected 3+ accounts, got ${accounts.length}. Found: [${names}]. Debug: ${JSON.stringify(metadata.debug_rows?.slice(0, 15))}`);

    const rentAccount = accounts.find((a) => /rent/i.test(a.name));
    assert.ok(rentAccount, `Should find Rent. Found: [${names}]`);
    assert.strictEqual(rentAccount.section, 'expenses');

    const incomeAccounts = accounts.filter((a) => a.section === 'income');
    assert.ok(incomeAccounts.length >= 1, `Should have income accounts. Found: [${names}]`);
  });

  it('handles multi-column label layout (labels in column B, values in column C)', () => {
    const buffer = makeQBOBuffer([
      ['', 'Company', ''],
      ['', 'Profit and Loss', ''],
      ['', '', 'Total'],
      ['', 'Income', ''],
      ['', '  Consulting Revenue', 200000],
      ['', 'Total Income', 200000],
      ['', 'Expenses', ''],
      ['', '  Marketing', 15000],
      ['', '  Insurance', 5000],
      ['', 'Total Expenses', 20000],
    ]);

    const { accounts, metadata } = extractAccounts(buffer, 'test.xlsx');
    assert.ok(accounts.length >= 2, `Expected 2+ accounts, got ${accounts.length}. Label col: ${metadata.label_column}, Value col: ${metadata.value_column}`);
  });

  it('excludes subtotals correctly', () => {
    const buffer = makeQBOBuffer([
      ['', 'Total'],
      ['Income', ''],
      ['  Product A', 50000],
      ['  Product B', 30000],
      ['  Product C', 20000],
      ['Total Income', 100000],
      ['Expenses', ''],
      ['  Rent', 12000],
      ['Total Expenses', 12000],
    ]);

    const { accounts } = extractAccounts(buffer, 'test.xlsx');
    const names = accounts.map((a) => a.name.trim().toLowerCase());
    assert.ok(!names.some((n) => n.startsWith('total ')), 'Should not include total rows');
  });

  it('skips report header rows', () => {
    const buffer = makeQBOBuffer([
      ['Accrual Basis  January - December 2025'],
      ['Income', ''],
      ['  Sales', 50000],
      ['Total Income', 50000],
    ]);

    const { accounts } = extractAccounts(buffer, 'test.xlsx');
    const names = accounts.map((a) => a.name.trim().toLowerCase());
    assert.ok(!names.some((n) => /accrual/i.test(n)), 'Should not include header rows');
  });

  it('sums the last 12 month columns (rolling TTM) instead of lifetime Total for multi-month exports', () => {
    const monthNames = [
      'January 2025', 'February 2025', 'March 2025', 'April 2025',
      'May 2025', 'June 2025', 'July 2025', 'August 2025',
      'September 2025', 'October 2025', 'November 2025', 'December 2025',
    ];
    const header = ['Distribution account', ...monthNames, 'Total'];
    const salesVals = monthNames.map(() => 1000);
    const totalVal = 999999;
    const buffer = makeQBOBuffer([
      ['Co', ''],
      ['P&L', ''],
      ['', ''],
      header,
      ['Sales', ...salesVals, totalVal],
      ['Total for Income', ...monthNames.map(() => 0), 12000],
    ]);

    const { accounts, metadata } = extractAccounts(buffer, 'months.xlsx');

    assert.ok(metadata.monthly_mode, 'Should use monthly aggregation');
    assert.strictEqual(metadata.months_in_period, 12);
    const sales = accounts.find((a) => a.name === 'Sales');
    assert.ok(sales, 'Should extract Sales');
    assert.strictEqual(sales.amount, 12000, 'Sales should be sum of 12 months (not Total column)');
  });
});

describe('mapAccounts — section-aware matching', () => {
  it('maps income-section accounts to revenue even with industry-specific names', () => {
    const accounts = [
      { name: 'Deck Construction Revenue', amount: 180000, section: 'income' },
      { name: 'Pergola Installation', amount: 45000, section: 'income' },
      { name: 'Custom Outdoor Kitchens', amount: 30000, section: 'income' },
    ];

    const { matched, unmatched } = mapAccounts(accounts);
    assert.strictEqual(matched.length, 3, 'All income accounts should match');
    for (const m of matched) {
      assert.strictEqual(m.suggested_field, 'revenue', `${m.name} should map to revenue`);
    }
    assert.strictEqual(unmatched.length, 0);
  });

  it('maps expense-section accounts to other_opex as fallback', () => {
    const accounts = [
      { name: 'Random Custom Category', amount: 5000, section: 'expenses' },
      { name: 'Widget Polishing Fund', amount: 2000, section: 'expenses' },
    ];

    const { matched } = mapAccounts(accounts);
    assert.strictEqual(matched.length, 2);
    for (const m of matched) {
      assert.strictEqual(m.suggested_field, 'other_opex');
      assert.strictEqual(m.method, 'section_default');
    }
  });

  it('prefers name match over section default', () => {
    const accounts = [
      { name: 'Advertising', amount: 12000, section: 'expenses' },
    ];

    const { matched } = mapAccounts(accounts);
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].suggested_field, 'marketing');
    assert.strictEqual(matched[0].method, 'exact');
  });

  it('matches Landscaping Services by name', () => {
    const accounts = [
      { name: 'Landscaping Services', amount: 320000, section: 'income' },
    ];

    const { matched } = mapAccounts(accounts);
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].suggested_field, 'revenue');
    assert.strictEqual(matched[0].method, 'exact');
  });

  it('matches Officer Compensation by name', () => {
    const accounts = [
      { name: 'Officer Compensation', amount: 85000, section: 'expenses' },
    ];

    const { matched } = mapAccounts(accounts);
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].suggested_field, 'owner_management_wage');
  });
});
