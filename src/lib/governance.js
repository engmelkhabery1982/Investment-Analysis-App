// Data Governance & Integrity Engine — evaluates data quality and analysis
// completeness across the universal model. Produces issue objects, never
// investment recommendations.
import { parseDate } from './finance';
import { CLOSED_STATUSES } from './model';

export const SEVERITY = { INFO: 'INFO', WARNING: 'WARNING', ERROR: 'ERROR', BLOCKING: 'BLOCKING' };
export const STATUS = { READY: 'READY', WARNING: 'WARNING', INCOMPLETE: 'INCOMPLETE', INVALID: 'INVALID', PARTIAL: 'PARTIAL', DEMO: 'DEMO' };

export const SEVERITY_RANK = { INFO: 0, WARNING: 1, ERROR: 2, BLOCKING: 3 };

function issue(code, severity, category, investmentId, message, reason, action, blocksAnalysis, transactionId = null, date = null) {
  return { code, severity, category, investmentId, transactionId, date, message, reason, action, blocksAnalysis };
}

// Per-investment checks (transactions + market context).
export function checkInvestment(inv, transactions, market = {}, settings = {}) {
  const issues = [];
  if (!inv) return issues;
  const iid = inv.id;
  const isClosed = CLOSED_STATUSES.includes(inv.status);

  if (!inv.valuationDate) {
    issues.push(issue('VAL001', SEVERITY.BLOCKING, 'Valuation', iid, 'Valuation date is missing', 'Performance cannot be computed without a valuation date.', 'Set a valuation date.', true));
  }
  if (!isClosed && !(Number(inv.currentValuation) > 0)) {
    issues.push(issue('VAL002', SEVERITY.WARNING, 'Valuation', iid, 'Current value is missing or zero', 'An active investment has no current valuation; metrics will be understated.', 'Enter a current / terminal value.', false));
  }
  if (isClosed && Number(inv.currentValuation) > 0) {
    issues.push(issue('VAL003', SEVERITY.WARNING, 'Valuation', iid, 'Closed investment still has a remaining value', 'Closed/Sold or Matured investments should have terminal value 0 unless partially exited.', 'Set value to 0 or change status to Partially Exited.', false));
  }
  if (!inv.type) {
    issues.push(issue('INV001', SEVERITY.INFO, 'Investment', iid, 'Investment type missing', 'Defaulting to Real Estate.', 'Set the investment type.', false));
  }

  const txs = transactions || [];
  if (!txs.length) {
    issues.push(issue('TXN001', SEVERITY.WARNING, 'Transactions', iid, 'No transactions recorded', 'No cash flows to analyze.', 'Add purchase / transaction records.', false));
  }
  const seenKeys = new Set();
  txs.forEach(t => {
    if (!t.date) issues.push(issue('TXN002', SEVERITY.ERROR, 'Transactions', iid, 'A transaction has no date', 'Date is required.', 'Fix the transaction date.', false, t.id));
    if (t.status !== 'refunded' && !(Number(t.amount) > 0)) issues.push(issue('TXN003', SEVERITY.ERROR, 'Transactions', iid, 'A transaction has an invalid amount', 'Amount must be greater than 0 (unless refunded).', 'Fix the amount.', false, t.id));
    if (!t.direction) issues.push(issue('TXN004', SEVERITY.INFO, 'Transactions', iid, 'A transaction has no direction', 'Defaulting to outflow.', 'Set inflow/outflow.', false, t.id));
    if (t.date && inv.valuationDate && t.status === 'paid' && parseDate(t.date) >= parseDate(inv.valuationDate))
      issues.push(issue('TXN005', SEVERITY.WARNING, 'Transactions', iid, 'Transaction is on or after the valuation date', 'Excluded from valuation calculations.', 'Adjust the date or valuation date.', false, t.id, t.date));
    if (!t.transactionType) issues.push(issue('TXN006', SEVERITY.INFO, 'Transactions', iid, 'A transaction has no type', 'Transaction type helps classify income/expenses.', 'Set a transaction type.', false, t.id));
    // duplicate detection within investment
    const key = `${t.date}|${t.amount}|${t.direction || 'outflow'}|${t.transactionType || ''}`;
    if (seenKeys.has(key)) issues.push(issue('TXN007', SEVERITY.WARNING, 'Transactions', iid, 'Possible duplicate transaction', 'Same date, amount, direction and type already exists.', 'Verify and remove if duplicate.', false, t.id, t.date));
    else seenKeys.add(key);
  });

  // demo-data usage on a real investment
  const usesDemoMarket =
    (market.gold || []).some(g => g.quality === 'Demo' || /DEMO/i.test(g.source || '')) ||
    (market.fx || []).some(f => f.quality === 'Demo' || /DEMO/i.test(f.source || '')) ||
    (market.cpi || []).some(c => /DEMO/i.test(c.source || ''));
  const isDemoInv = /DEMO/i.test(inv.name || '') || /DEMO/i.test(inv.notes || '');
  if (!isDemoInv && usesDemoMarket) {
    issues.push(issue('DMO001', SEVERITY.WARNING, 'Data Source', iid, 'Real investment depends on demo market data', 'Benchmark comparisons use demo Gold/FX/CPI data.', 'Import real market data.', false));
  }

  return issues;
}

// Market-data integrity checks (gold / fx / cpi / custom benchmarks).
export function checkMarketData(state = {}) {
  const issues = [];
  (state.gold || []).forEach(g => {
    if (!(Number(g.ask) > 0)) issues.push(issue('MKT001', SEVERITY.ERROR, 'Gold', null, `Gold ask invalid for ${g.date || '?'}`, 'Ask must be > 0.', 'Fix or remove the record.', false, g.id, g.date));
    if (!(Number(g.bid) > 0)) issues.push(issue('MKT002', SEVERITY.ERROR, 'Gold', null, `Gold bid invalid for ${g.date || '?'}`, 'Bid must be > 0.', 'Fix or remove the record.', false, g.id, g.date));
    if (Number(g.bid) > Number(g.ask) && g.bid && g.ask) issues.push(issue('MKT003', SEVERITY.WARNING, 'Gold', null, `Gold bid > ask for ${g.date}`, 'Bid should not exceed ask (investor buy price).', 'Verify the prices.', false, g.id, g.date));
  });
  (state.fx || []).forEach(f => {
    if (!f.base || !f.quote) issues.push(issue('MKT004', SEVERITY.ERROR, 'FX', null, `FX pair missing for ${f.date || '?'}`, 'Base/quote required.', 'Fix the pair.', false, f.id, f.date));
    if (!(Number(f.ask) > 0) || !(Number(f.bid) > 0)) issues.push(issue('MKT005', SEVERITY.ERROR, 'FX', null, `FX bid/ask invalid for ${f.date || '?'}`, 'Bid and ask must be > 0.', 'Fix the rates.', false, f.id, f.date));
    if (Number(f.bid) > Number(f.ask) && f.bid && f.ask) issues.push(issue('MKT006', SEVERITY.WARNING, 'FX', null, `FX bid > ask for ${f.date}`, 'Verify the rates.', 'Check the rates.', false, f.id, f.date));
  });
  (state.cpi || []).forEach(c => {
    if (!(Number(c.cpiValue) > 0)) issues.push(issue('MKT007', SEVERITY.ERROR, 'CPI', null, `CPI invalid for ${c.effectiveDate || '?'}`, 'CPI must be > 0.', 'Fix the value.', false, c.id, c.effectiveDate));
  });
  (state.customBenchmarks || []).forEach(cb => {
    const seen = new Set();
    (cb.data || []).forEach(r => {
      if (!(Number(r.value) > 0)) issues.push(issue('MKT008', SEVERITY.WARNING, 'Benchmark', null, `${cb.name} has invalid value for ${r.date}`, 'Price/index must be > 0.', 'Fix the value.', false, r.date, r.date));
      if (seen.has(r.date)) issues.push(issue('MKT009', SEVERITY.WARNING, 'Benchmark', null, `${cb.name} duplicate date ${r.date}`, 'Duplicate date in custom benchmark.', 'Remove the duplicate.', false, r.date, r.date));
      else seen.add(r.date);
    });
  });
  return issues;
}

// Roll a list of issues up to a single status.
export function rollupStatus(issues) {
  if (!issues || !issues.length) return STATUS.READY;
  if (issues.some(i => i.severity === SEVERITY.BLOCKING)) return STATUS.INVALID;
  if (issues.some(i => i.severity === SEVERITY.ERROR)) return STATUS.INCOMPLETE;
  if (issues.some(i => i.severity === SEVERITY.WARNING)) return STATUS.WARNING;
  return STATUS.READY;
}

// Date-gap classification for benchmark date resolution.
export function dateGapStatus(days) {
  if (days == null) return { status: STATUS.INCOMPLETE, label: 'No data' };
  if (days === 0) return { status: STATUS.READY, label: 'Exact' };
  if (days <= 3) return { status: STATUS.READY, label: 'Good' };
  if (days <= 7) return { status: STATUS.WARNING, label: 'Warning' };
  return { status: STATUS.WARNING, label: 'Strong warning' };
}