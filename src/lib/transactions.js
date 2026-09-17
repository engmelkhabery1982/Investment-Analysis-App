// Universal transaction helpers — sign convention, eligibility, aggregation.
// Convention: outflow = negative economic cash flow, inflow = positive.
// The UI stores `amount` as a positive entered value with a separate `direction`.
import { parseDate } from './finance';
import { CAPITAL_RETURN_TYPES, PARTIAL_CAPITAL_RETURN_TYPES } from './model';

export function isOutflow(t) { return (t.direction || 'outflow') === 'outflow'; }
export function isInflow(t) { return t.direction === 'inflow'; }

// Signed economic amount (outflow negative, inflow positive).
export function signedAmount(t) {
  const a = Number(t.amount) || 0;
  return isOutflow(t) ? -a : a;
}

// Eligible transactions: paid, strictly before valuation date, chronological.
export function eligibleTransactions(transactions, valuationDate) {
  if (!valuationDate) return [];
  const v = parseDate(valuationDate);
  return (transactions || [])
    .filter(t => t.status === 'paid')
    .filter(t => t.date && parseDate(t.date) < v)
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
}

export function sum(arr) {
  return (arr || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

export function outflows(txs) { return (txs || []).filter(isOutflow); }
export function inflows(txs) { return (txs || []).filter(isInflow); }

// Partial capital returns that reduce the invested-capital basis (Capital Return,
// Partial Sale). Full Sale is excluded — it is the terminal exit, not a basis reduction.
export function capitalReturns(txs) {
  return (txs || []).filter(t => isInflow(t) && PARTIAL_CAPITAL_RETURN_TYPES.includes(t.transactionType));
}

// Inflows that are income (rent, dividend, interest, distribution, other income).
export function incomeInflows(txs) {
  return (txs || []).filter(t => isInflow(t) && !CAPITAL_RETURN_TYPES.includes(t.transactionType));
}