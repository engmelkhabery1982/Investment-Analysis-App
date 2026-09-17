import { parseDate } from './finance';

export function validateInvestment(inv) {
  const errors = [];
  if (!inv.name || !inv.name.trim()) errors.push('Investment name is required.');
  if (!inv.valuationDate) errors.push('Valuation date is required.');
  if (!(Number(inv.currentValuation) > 0)) errors.push('Current property valuation must be greater than 0.');
  if (!inv.purchaseCurrency) errors.push('Purchase currency is required.');
  return errors;
}

export function validateCashFlow(cf, valuationDate) {
  const errors = [];
  if (!cf.date) errors.push('Payment date is required.');
  if (cf.status !== 'refunded' && !(Number(cf.amount) > 0)) errors.push('Amount must be greater than 0 (unless refunded).');
  if (!cf.currency) errors.push('Currency is required.');
  if (cf.date && valuationDate && cf.status === 'paid' && parseDate(cf.date) >= parseDate(valuationDate)) {
    errors.push('Payment date must be before the valuation date.');
  }
  return errors;
}

export function validateGold(g) {
  const errors = [];
  if (!g.date) errors.push('Date is required.');
  if (!(Number(g.ask) > 0)) errors.push('Ask price must be greater than 0.');
  if (!(Number(g.bid) > 0)) errors.push('Bid price must be greater than 0.');
  if (Number(g.bid) > Number(g.ask) && g.bid && g.ask) errors.push('Bid is greater than Ask. Please verify.');
  if (!g.karat) errors.push('Gold type is required.');
  return errors;
}

export function validateFx(f) {
  const errors = [];
  if (!f.date) errors.push('Date is required.');
  if (!f.base || !f.quote) errors.push('Currency pair is required.');
  if (!(Number(f.ask) > 0)) errors.push('Ask must be greater than 0.');
  if (!(Number(f.bid) > 0)) errors.push('Bid must be greater than 0.');
  if (Number(f.bid) > Number(f.ask) && f.bid && f.ask) errors.push('Bid is greater than Ask. Please verify.');
  return errors;
}

export function validateCpi(c) {
  const errors = [];
  if (!c.effectiveDate) errors.push('Effective date is required.');
  if (!(Number(c.cpiValue) > 0)) errors.push('CPI value must be greater than 0.');
  return errors;
}

// Duplicate detection: keyFn returns a string key per record.
export function findDuplicates(records, keyFn) {
  const seen = new Map();
  const dups = [];
  for (const r of records) {
    const k = keyFn(r);
    if (seen.has(k)) dups.push(r);
    else seen.set(k, r);
  }
  return dups;
}