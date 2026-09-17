// Universal investment model configuration — single source of truth for types,
// statuses, transaction directions and transaction types. Pure data, no deps.

export const INVESTMENT_TYPES = {
  real_estate: { label: 'Real Estate', valueLabel: 'Current property valuation' },
  gold: { label: 'Gold', valueLabel: 'Current liquidation value' },
  currency: { label: 'Foreign Currency', valueLabel: 'Current value (in base currency)' },
  stock: { label: 'Stock', valueLabel: 'Current market value' },
  etf: { label: 'ETF / Fund', valueLabel: 'Current market value' },
  deposit: { label: 'Bank Deposit / Fixed Income', valueLabel: 'Current balance / maturity value' },
  business: { label: 'Business / Private Investment', valueLabel: 'Current valuation' },
  custom: { label: 'Custom Investment', valueLabel: 'Current / terminal value' },
};

export const INVESTMENT_TYPE_ORDER = [
  'real_estate', 'gold', 'currency', 'stock', 'etf', 'deposit', 'business', 'custom',
];

export const INVESTMENT_STATUSES = [
  'Active', 'Partially Exited', 'Closed/Sold', 'Matured', 'Cancelled', 'Archived',
];

export const CLOSED_STATUSES = ['Closed/Sold', 'Matured', 'Archived'];

export const DIRECTIONS = [
  { value: 'outflow', label: 'Outflow (money paid out)' },
  { value: 'inflow', label: 'Inflow (money received)' },
];

// Transaction types grouped by direction. UI builds the dropdown from these.
export const TRANSACTION_TYPES = {
  outflow: [
    'Purchase', 'Down Payment', 'Installment', 'Additional Investment',
    'Capital Contribution', 'Maintenance', 'Registration Fee', 'Brokerage Fee',
    'Transaction Fee', 'Tax', 'Management Fee', 'Financing Cost', 'Other Expense',
  ],
  inflow: [
    'Rent', 'Dividend', 'Interest', 'Distribution', 'Refund',
    'Partial Sale', 'Full Sale', 'Capital Return', 'Other Income',
  ],
};

export function transactionTypesFor(direction) {
  return TRANSACTION_TYPES[direction] || TRANSACTION_TYPES.outflow;
}

// Inflow types that represent return of capital (not income).
export const CAPITAL_RETURN_TYPES = ['Capital Return', 'Partial Sale', 'Full Sale'];

// Partial capital returns reduce the invested-capital basis while the investment
// is still held. Full Sale is the terminal exit and is not subtracted from basis
// (it is counted in total economic value instead), avoiding negative basis.
export const PARTIAL_CAPITAL_RETURN_TYPES = ['Capital Return', 'Partial Sale'];

export const CURRENCIES = ['EGP', 'USD', 'SAR', 'EUR', 'AED', 'GBP', 'CHF', 'JPY'];

export const COMPOUNDING = [
  { value: 'annual', label: 'Annual' },
  { value: 'monthly', label: 'Monthly' },
];