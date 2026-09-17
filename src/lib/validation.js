import { parseDate } from './finance';
import { CLOSED_STATUSES } from './model';

// Universal investment validation. Current value is required only for active
// (non-closed) investments.
export function validateInvestment(inv) {
  const errors = [];
  if (!inv.name || !inv.name.trim()) errors.push('Investment name is required.');
  if (!inv.valuationDate) errors.push('Valuation date is required.');
  if (!inv.type) errors.push('Investment type is required.');
  if (!inv.status) errors.push('Investment status is required.');
  const isClosed = CLOSED_STATUSES.includes(inv.status);
  if (!isClosed && !(Number(inv.currentValuation) > 0)) errors.push('Current / terminal value must be greater than 0 for active investments.');
  if (!inv.baseCurrency && !inv.purchaseCurrency) errors.push('Base currency is required.');
  return errors;
}

// Universal transaction validation (replaces validateCashFlow).
export function validateTransaction(cf, valuationDate) {
  const errors = [];
  if (!cf.date) errors.push('Transaction date is required.');
  if (cf.status !== 'refunded' && !(Number(cf.amount) > 0)) errors.push('Amount must be greater than 0 (unless refunded).');
  if (!cf.currency) errors.push('Currency is required.');
  if (!cf.direction) errors.push('Direction (inflow/outflow) is required.');
  if (cf.date && valuationDate && cf.status === 'paid' && parseDate(cf.date) >= parseDate(valuationDate)) {
    errors.push('Paid transaction date must be before the valuation date.');
  }
  return errors;
}

// Backward-compatible alias.
export function validateCashFlow(cf, valuationDate) {
  return validateTransaction(cf, valuationDate);
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

export function validateCustomBenchmark(cb) {
  const errors = [];
  if (!cb.name || !cb.name.trim()) errors.push('Benchmark name is required.');
  if (!cb.currency) errors.push('Benchmark currency is required.');
  if (!cb.data || !cb.data.length) errors.push('At least one data point is required.');
  (cb.data || []).forEach((r, i) => {
    if (!r.date) errors.push(`Row ${i + 1}: date is required.`);
    if (!(Number(r.value) > 0)) errors.push(`Row ${i + 1}: value must be greater than 0.`);
  });
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