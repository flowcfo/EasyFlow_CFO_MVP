/**
 * Realistic mock QBO ProfitAndLoss report for demo/simulation purposes.
 * Represents a home-services business doing ~$850K/year.
 */
export const mockQBOReport = {
  Header: {
    ReportName: 'ProfitAndLoss',
    DateMacro: 'Last Fiscal Year',
    StartPeriod: '2025-01-01',
    EndPeriod: '2025-12-31',
    Currency: 'USD',
    Option: [
      { Name: 'AccountingMethod', Value: 'Accrual' },
      { Name: 'NoReportData', Value: 'false' },
    ],
  },
  Columns: {
    Column: [
      { ColTitle: '', ColType: 'Account', MetaData: [{ Name: 'ColKey', Value: 'account' }] },
      { ColTitle: 'Total', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'total' }] },
    ],
  },
  Rows: {
    Row: [
      {
        type: 'Section',
        Header: { ColData: [{ value: 'Income' }, { value: '' }] },
        Rows: {
          Row: [
            { type: 'Data', ColData: [{ value: 'Service Revenue' }, { value: '645000.00' }] },
            { type: 'Data', ColData: [{ value: 'Product Sales' }, { value: '125000.00' }] },
            { type: 'Data', ColData: [{ value: 'Maintenance Contracts' }, { value: '82000.00' }] },
          ],
        },
        Summary: { ColData: [{ value: 'Total Income' }, { value: '852000.00' }] },
        group: 'Income',
      },
      {
        type: 'Section',
        Header: { ColData: [{ value: 'Cost of Goods Sold' }, { value: '' }] },
        Rows: {
          Row: [
            { type: 'Data', ColData: [{ value: 'Materials & Supplies' }, { value: '148000.00' }] },
            { type: 'Data', ColData: [{ value: 'Equipment Costs' }, { value: '42000.00' }] },
            { type: 'Data', ColData: [{ value: 'Direct Labor' }, { value: '95000.00' }] },
          ],
        },
        Summary: { ColData: [{ value: 'Total COGS' }, { value: '285000.00' }] },
        group: 'Cost of Goods Sold',
      },
      {
        type: 'Section',
        Header: { ColData: [{ value: 'Expenses' }, { value: '' }] },
        Rows: {
          Row: [
            { type: 'Data', ColData: [{ value: 'Payroll & Wages' }, { value: '185000.00' }] },
            { type: 'Data', ColData: [{ value: 'Subcontractor Expenses' }, { value: '62000.00' }] },
            { type: 'Data', ColData: [{ value: 'Advertising & Marketing' }, { value: '38000.00' }] },
            { type: 'Data', ColData: [{ value: 'Rent & Facilities' }, { value: '48000.00' }] },
            { type: 'Data', ColData: [{ value: 'Insurance' }, { value: '24000.00' }] },
            { type: 'Data', ColData: [{ value: 'Software & Subscriptions' }, { value: '9600.00' }] },
            { type: 'Data', ColData: [{ value: 'Vehicle Expenses' }, { value: '18000.00' }] },
            { type: 'Data', ColData: [{ value: 'Office Supplies' }, { value: '4200.00' }] },
            { type: 'Data', ColData: [{ value: 'Utilities' }, { value: '7800.00' }] },
            { type: 'Data', ColData: [{ value: 'Professional Fees' }, { value: '12000.00' }] },
            { type: 'Data', ColData: [{ value: 'Repairs & Maintenance' }, { value: '6500.00' }] },
            { type: 'Data', ColData: [{ value: 'Travel & Meals' }, { value: '5400.00' }] },
          ],
        },
        Summary: { ColData: [{ value: 'Total Expenses' }, { value: '420500.00' }] },
        group: 'Expenses',
      },
      {
        type: 'Section',
        Summary: { ColData: [{ value: 'Net Income' }, { value: '146500.00' }] },
        group: 'NetIncome',
      },
    ],
  },
};
