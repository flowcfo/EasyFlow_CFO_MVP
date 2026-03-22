export const INPUT_SHAPE = {
  revenue: { type: 'number', default: 0, label: 'Total Revenue' },
  cogs: { type: 'number', default: 0, label: 'Cost of Goods Sold' },
  owner_direct_labor: { type: 'number', default: 15000, label: 'Owner Direct Labor (Row 23)' },
  employee_direct_labor: { type: 'number', default: 0, label: 'Employee Direct Labor' },
  subcontractors: { type: 'number', default: 0, label: 'Subcontractors' },
  marketing: { type: 'number', default: 0, label: 'Marketing and Advertising' },
  owner_management_wage: { type: 'number', default: 15000, label: 'Owner Management Wage (Row 42)' },
  rent: { type: 'number', default: 0, label: 'Rent' },
  insurance: { type: 'number', default: 0, label: 'Insurance' },
  software_subscriptions: { type: 'number', default: 0, label: 'Software and Subscriptions' },
  other_opex: { type: 'number', default: 0, label: 'Other Operating Expenses' },
  owner_market_wage_annual: { type: 'number', default: 0, label: 'Owner Market Wage (Annual)' },
  tax_rate: { type: 'number', default: 0.40, label: 'Tax Rate' },
  core_capital_months: { type: 'number', default: 2, label: 'Core Capital Months' },
  operating_months_per_year: { type: 'number', default: 12, label: 'Operating Months per Year' },
};

export const INPUT_FIELDS = Object.keys(INPUT_SHAPE);

export const INPUT_SECTIONS = [
  {
    title: 'Revenue',
    fields: ['revenue'],
  },
  {
    title: 'Cost of Goods Sold',
    tooltip: 'Materials only. No labor in COGS.',
    fields: ['cogs'],
  },
  {
    title: 'Direct Labor',
    fields: ['owner_direct_labor', 'employee_direct_labor', 'subcontractors'],
  },
  {
    title: 'Marketing',
    fields: ['marketing'],
  },
  {
    title: 'Operating Expenses',
    fields: ['owner_management_wage', 'rent', 'insurance', 'software_subscriptions', 'other_opex'],
  },
  {
    title: 'Owner Pay Configuration',
    fields: ['owner_market_wage_annual'],
  },
  {
    title: 'Assumptions',
    tooltip: 'If the business is closed part of the year, set operating months (used for breakeven “required monthly” spread).',
    fields: ['tax_rate', 'core_capital_months', 'operating_months_per_year'],
  },
];

export function validateInputs(inputs) {
  const errors = {};
  for (const [key, config] of Object.entries(INPUT_SHAPE)) {
    const val = inputs[key];
    if (val === undefined || val === null || val === '') {
      errors[key] = `${config.label} is required`;
    } else if (typeof val !== 'number' || isNaN(val)) {
      errors[key] = `${config.label} must be a number`;
    }
  }
  if (inputs.tax_rate !== undefined && (inputs.tax_rate < 0 || inputs.tax_rate > 1)) {
    errors.tax_rate = 'Tax rate must be between 0 and 1';
  }
  if (inputs.core_capital_months !== undefined && inputs.core_capital_months < 0) {
    errors.core_capital_months = 'Core capital months must be 0 or greater';
  }
  if (inputs.operating_months_per_year !== undefined) {
    const n = inputs.operating_months_per_year;
    if (typeof n !== 'number' || isNaN(n) || n < 1 || n > 12) {
      errors.operating_months_per_year = 'Operating months must be between 1 and 12';
    }
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getDefaultInputs() {
  const defaults = {};
  for (const [key, config] of Object.entries(INPUT_SHAPE)) {
    defaults[key] = config.default;
  }
  return defaults;
}
