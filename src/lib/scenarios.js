// Scenario engine — applies assumption overrides to a *copy* of an investment
// and re-runs the centralized performance engine. The original investment,
// transactions and market data are never mutated.
import { analyzeInvestment } from './performance';
import { parseDate } from './finance';
import { CLOSED_STATUSES, INVESTMENT_STATUSES } from './model';

// A scenario overrides only these keys; anything absent falls back to actual data.
export const SCENARIO_FIELDS = [
  'currentValuation', 'valuationDate', 'status',
  'fixedReturnRate', 'fixedReturnCompounding',
  'exitFees', 'customBenchmarkIds',
];

// Build a new analysis context from overrides. Returns { analysis, warnings }.
export function applyScenario({ investment, transactions, gold, fx, cpi, customBenchmarks, settings }, overrides = {}) {
  const warnings = [];
  const inv = { ...investment };

  // Alternative current/terminal value.
  const baseValue = (overrides.currentValuation != null && overrides.currentValuation !== '')
    ? Number(overrides.currentValuation)
    : (Number(investment.currentValuation) || 0);

  // Exit fees reduce the terminal proceeds (modeled as a reduction of current value
  // so the engine handles gain/MOIC/XIRR consistently).
  const fee = Number(overrides.exitFees) || 0;
  const effectiveFee = fee > 0 ? fee : 0;

  const isClosed = CLOSED_STATUSES.includes(inv.status) || CLOSED_STATUSES.includes(overrides.status);
  if (isClosed) {
    inv.currentValuation = 0;
    if (effectiveFee > 0) warnings.push('Exit fees are ignored for closed/exited investments (terminal value is already realized).');
  } else {
    inv.currentValuation = Math.max(0, baseValue - effectiveFee);
  }

  // Status override.
  if (overrides.status && INVESTMENT_STATUSES.includes(overrides.status)) inv.status = overrides.status;

  // Valuation-date override — only applied when safe (strictly after the last paid
  // transaction), otherwise we keep the original date and warn.
  if (overrides.valuationDate) {
    const paidDates = (transactions || []).filter(t => t.status === 'paid' && t.date).map(t => parseDate(t.date));
    const lastTx = paidDates.length ? paidDates.sort((a, b) => a - b)[paidDates.length - 1] : null;
    if (lastTx && parseDate(overrides.valuationDate) <= lastTx) {
      warnings.push(`Scenario valuation date ${overrides.valuationDate} is on or before the last transaction; not applied to keep the analysis valid.`);
    } else {
      inv.valuationDate = overrides.valuationDate;
    }
  }

  // Settings overrides (fixed-return benchmark assumption).
  const scenarioSettings = { ...settings };
  if (overrides.fixedReturnRate != null && overrides.fixedReturnRate !== '') scenarioSettings.fixedReturnRate = Number(overrides.fixedReturnRate);
  if (overrides.fixedReturnCompounding) scenarioSettings.fixedReturnCompounding = overrides.fixedReturnCompounding;

  // Custom benchmark assumption — filter to selected ids.
  let scenarioCustom = customBenchmarks || [];
  if (overrides.customBenchmarkIds && Array.isArray(overrides.customBenchmarkIds) && overrides.customBenchmarkIds.length) {
    scenarioCustom = scenarioCustom.filter(cb => overrides.customBenchmarkIds.includes(cb.id));
  }

  const analysis = analyzeInvestment({
    investment: inv,
    transactions: transactions || [],
    gold, fx, cpi,
    customBenchmarks: scenarioCustom,
    settings: scenarioSettings,
  });

  return { analysis, warnings };
}