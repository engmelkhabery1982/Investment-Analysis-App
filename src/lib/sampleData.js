// Clearly-labelled DEMO data. User can remove it from Settings.
export const DEMO_TAG = 'DEMO DATA';

export function defaultSettings() {
  return {
    defaultCurrency: 'EGP',
    defaultGoldType: '21K',
    defaultDatePolicy: 'previous',
    enabledCurrencies: ['USD', 'SAR'],
    displayPrecision: 2,
    xnpvDiscountRate: 0.10,
    fixedReturnRate: 0.12,
    fixedReturnCompounding: 'annual',
    selectedInvestmentId: null,
  };
}

export function sampleState() {
  const investment = {
    id: 'demo-investment-1',
    name: 'Demo Apartment (DEMO DATA)',
    type: 'real_estate',
    status: 'Active',
    baseCurrency: 'EGP',
    projectName: 'Demo Towers',
    developer: 'Demo Developer',
    description: 'Sample investment for demonstration only. Remove via Settings.',
    propertyType: 'Apartment',
    unitNumber: 'D-101',
    location: 'Cairo, Egypt',
    purchaseCurrency: 'EGP',
    contractDate: '2024-09-01',
    analysisStartDate: '2024-09-01',
    valuationDate: '2026-08-01',
    originalContractValue: 1000000,
    currentValuation: 1100000,
    currentValuationCurrency: 'EGP',
    notes: 'Fictional sample.',
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
  };

  const cashflows = [
    { id: 'cf-1', investmentId: investment.id, date: '2024-09-01', amount: 500000, currency: 'EGP', direction: 'outflow', transactionType: 'Down Payment', description: 'Down payment', installmentNumber: 1, status: 'paid', notes: DEMO_TAG },
    { id: 'cf-2', investmentId: investment.id, date: '2025-01-15', amount: 250000, currency: 'EGP', direction: 'outflow', transactionType: 'Installment', description: 'Installment', installmentNumber: 2, status: 'paid', notes: DEMO_TAG },
    { id: 'cf-3', investmentId: investment.id, date: '2025-06-01', amount: 250000, currency: 'EGP', direction: 'outflow', transactionType: 'Installment', description: 'Installment', installmentNumber: 3, status: 'paid', notes: DEMO_TAG },
  ];

  const gold = [
    { id: 'g-1', date: '2024-09-01', karat: '21K', unit: 'gram', ask: 4200, bid: 4100, source: DEMO_TAG, sourceDate: '2024-09-01', notes: '', quality: 'Demo' },
    { id: 'g-2', date: '2025-01-15', karat: '21K', unit: 'gram', ask: 4500, bid: 4400, source: DEMO_TAG, sourceDate: '2025-01-15', notes: '', quality: 'Demo' },
    { id: 'g-3', date: '2025-06-01', karat: '21K', unit: 'gram', ask: 4800, bid: 4700, source: DEMO_TAG, sourceDate: '2025-06-01', notes: '', quality: 'Demo' },
    { id: 'g-4', date: '2026-08-01', karat: '21K', unit: 'gram', ask: 6200, bid: 6100, source: DEMO_TAG, sourceDate: '2026-08-01', notes: '', quality: 'Demo' },
  ];

  const fx = [
    { id: 'fx-1', date: '2024-09-01', base: 'USD', quote: 'EGP', bid: 48.0, ask: 48.5, source: DEMO_TAG, notes: '', quality: 'Demo' },
    { id: 'fx-2', date: '2025-01-15', base: 'USD', quote: 'EGP', bid: 49.8, ask: 50.2, source: DEMO_TAG, notes: '', quality: 'Demo' },
    { id: 'fx-3', date: '2025-06-01', base: 'USD', quote: 'EGP', bid: 50.5, ask: 51.0, source: DEMO_TAG, notes: '', quality: 'Demo' },
    { id: 'fx-4', date: '2026-08-01', base: 'USD', quote: 'EGP', bid: 57.5, ask: 58.0, source: DEMO_TAG, notes: '', quality: 'Demo' },
    { id: 'fx-5', date: '2024-09-01', base: 'SAR', quote: 'EGP', bid: 12.80, ask: 12.95, source: DEMO_TAG, notes: '', quality: 'Demo' },
    { id: 'fx-6', date: '2025-01-15', base: 'SAR', quote: 'EGP', bid: 13.30, ask: 13.40, source: DEMO_TAG, notes: '', quality: 'Demo' },
    { id: 'fx-7', date: '2025-06-01', base: 'SAR', quote: 'EGP', bid: 13.55, ask: 13.60, source: DEMO_TAG, notes: '', quality: 'Demo' },
    { id: 'fx-8', date: '2026-08-01', base: 'SAR', quote: 'EGP', bid: 15.40, ask: 15.50, source: DEMO_TAG, notes: '', quality: 'Demo' },
  ];

  const cpi = [
    { id: 'cpi-1', effectiveDate: '2024-09-01', cpiValue: 200, frequency: 'monthly', country: 'Egypt', source: DEMO_TAG, notes: '' },
    { id: 'cpi-2', effectiveDate: '2025-01-15', cpiValue: 210, frequency: 'monthly', country: 'Egypt', source: DEMO_TAG, notes: '' },
    { id: 'cpi-3', effectiveDate: '2025-06-01', cpiValue: 220, frequency: 'monthly', country: 'Egypt', source: DEMO_TAG, notes: '' },
    { id: 'cpi-4', effectiveDate: '2026-08-01', cpiValue: 260, frequency: 'monthly', country: 'Egypt', source: DEMO_TAG, notes: '' },
  ];

  const customBenchmarks = [];
  const scenarios = [];

  const settings = defaultSettings();
  settings.selectedInvestmentId = investment.id;

  return { investments: [investment], cashflows, gold, fx, cpi, customBenchmarks, scenarios, settings };
}

export function emptyState() {
  return {
    investments: [], cashflows: [], gold: [], fx: [], cpi: [],
    customBenchmarks: [], scenarios: [], settings: defaultSettings(),
  };
}