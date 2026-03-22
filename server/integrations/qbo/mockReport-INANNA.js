/**
 * Minimal QBO Profit & Loss–style report for demo routes and tests.
 */
export const mockQBOReport = {
  Header: { ReportName: [{ value: 'ProfitAndLoss' }] },
  Columns: {
    Column: [
      { ColType: 'Account', ColTitle: 'Account' },
      { ColType: 'Money', ColTitle: 'Total' },
    ],
  },
  Rows: {
    Row: [
      {
        Header: { ColData: [{ value: 'Income' }] },
        Rows: {
          Row: [
            { ColData: [{ value: 'Service Revenue' }, { value: '480000' }] },
            { ColData: [{ value: 'Other Income' }, { value: '12000' }] },
          ],
        },
      },
      {
        Header: { ColData: [{ value: 'Cost of Goods Sold' }] },
        Rows: {
          Row: [{ ColData: [{ value: 'Materials' }, { value: '95000' }] }],
        },
      },
      {
        Header: { ColData: [{ value: 'Expenses' }] },
        Rows: {
          Row: [
            { ColData: [{ value: 'Marketing & Advertising' }, { value: '18000' }] },
            { ColData: [{ value: 'Rent' }, { value: '24000' }] },
            { ColData: [{ value: 'Insurance' }, { value: '6000' }] },
            { ColData: [{ value: 'Software & Subscriptions' }, { value: '4200' }] },
            { ColData: [{ value: 'Wages – Field' }, { value: '85000' }] },
            { ColData: [{ value: 'Owner Draw / Payroll' }, { value: '36000' }] },
          ],
        },
      },
    ],
  },
};
