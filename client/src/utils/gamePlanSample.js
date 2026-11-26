/**
 * Sample Game Plan numbers, shown until the client's Profit System workbook is
 * connected (stage 2). The shape mirrors the workbook's GAME_PLAN tab so the
 * screen can switch to real data without changing:
 *   targets    -> GAME_PLAN B10:B18 (annual targets) vs D10:D18 (current TTM)
 *   guardrails -> GAME_PLAN B21:D23 plus ASSUMPTIONS B31:B34
 *   months     -> GAME_PLAN row 27 (months), row 29 (revenue target), INPUT row 10 (actual)
 *   gaps       -> GAME_PLAN B43:B47
 */
export const SAMPLE_GAME_PLAN = {
  isSample: true,
  businessName: 'Sample Company',
  planStart: '2026-11-01',
  planEnd: '2027-10-01',
  closedThrough: '2026-12-01',
  updatedAt: null,
  targets: {
    revenue: { target: 3400000, current: 3120000 },
    pretaxProfit: { target: 340000, current: 131000, targetPct: 0.10, currentPct: 0.042 },
    ownerPay: { target: 160000, current: 120000 },
    coreCapital: { target: 65000, current: 35000, months: 2 },
  },
  guardrails: [
    {
      key: 'lpr',
      name: 'Labor',
      what: 'Gross margin for every $1 of direct labor',
      current: 2.05,
      low: 1.8,
      high: 2.5,
      scaleMax: 3.5,
      scaleMin: 1,
    },
    {
      key: 'mpr',
      name: 'Marketing',
      what: 'Gross margin for every $1 of marketing',
      current: 9.8,
      low: 5,
      high: null,
      scaleMax: 12,
      scaleMin: 0,
    },
    {
      key: 'manpr',
      name: 'Overhead',
      what: 'Contribution margin for every $1 of management pay',
      current: 0.86,
      low: 1.0,
      high: null,
      scaleMax: 2,
      scaleMin: 0,
    },
  ],
  months: [
    { month: '2026-11-01', target: 260000, actual: 268000 },
    { month: '2026-12-01', target: 231000, actual: 197000 },
    { month: '2027-01-01', target: 218000, actual: null },
    { month: '2027-02-01', target: 243000, actual: null },
    { month: '2027-03-01', target: 310000, actual: null },
    { month: '2027-04-01', target: 360000, actual: null },
    { month: '2027-05-01', target: 398000, actual: null },
    { month: '2027-06-01', target: 419000, actual: null },
    { month: '2027-07-01', target: 402000, actual: null },
    { month: '2027-08-01', target: 369000, actual: null },
    { month: '2027-09-01', target: 327000, actual: null },
    { month: '2027-10-01', target: 277000, actual: null },
  ],
  gaps: [
    { key: 'profit', label: 'Profit gap', note: 'Overhead is the biggest drag. See the Overhead guardrail.', amount: 209000 },
    { key: 'revenue', label: 'Revenue gap', note: 'Close with price, mix or volume.', amount: 280000 },
    { key: 'pay', label: 'Your pay gap', note: 'Staged raise plan in Tools, Owner Pay Roadmap.', amount: 40000 },
    { key: 'cash', label: 'Cash cushion gap', note: 'Funded by the weekly cash plan and faster collections.', amount: 30000 },
  ],
};
