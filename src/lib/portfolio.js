// Portfolio aggregation — single source of truth lives in performance.js.
// We aggregate each investment's centralized analysis (no reimplementation of
// ROI/XIRR/MOIC). Portfolio XIRR is computed over the combined signed cash-flow
// series + each investment's terminal value at its own valuation date, which is
// mathematically valid (we never average individual percentages).
import { analyzeInvestment, computeXIRR, computeXNPV } from './performance';
import { signedAmount } from './transactions';
import { parseDate } from './finance';
import { INVESTMENT_TYPES } from './model';

export function analyzePortfolio(state) {
  const { investments, cashflows, gold, fx, cpi, customBenchmarks, settings } = state;
  const items = (investments || []).map(inv => {
    const transactions = (cashflows || []).filter(c => c.investmentId === inv.id);
    const analysis = analyzeInvestment({ investment: inv, transactions, gold, fx, cpi, customBenchmarks, settings });
    return { investment: inv, analysis };
  });

  let totalInvestedCapital = 0;
  let totalEconomicValue = 0;
  let totalGain = 0;
  let totalRealInvested = 0;
  let totalRealGain = 0;
  for (const it of items) {
    const p = it.analysis.performance;
    totalInvestedCapital += p.netInvestedCapital;
    totalEconomicValue += p.totalEconomicValue;
    totalGain += p.gain;
    totalRealInvested += p.realInvestedCapital;
    totalRealGain += p.realGain;
  }
  const portfolioROI = totalInvestedCapital > 0 ? totalGain / totalInvestedCapital : 0;
  const portfolioMOIC = totalInvestedCapital > 0 ? totalEconomicValue / totalInvestedCapital : 0;
  const portfolioRealReturn = totalRealInvested > 0 ? totalRealGain / totalRealInvested : 0;

  // Aggregated XIRR over combined signed flows + terminal values.
  const signedFlows = [];
  for (const it of items) {
    const { investment: inv, analysis } = it;
    for (const t of analysis.eligible) signedFlows.push({ date: parseDate(t.date), amount: signedAmount(t) });
    if (!analysis.isClosed && (Number(inv.currentValuation) || 0) > 0) {
      signedFlows.push({ date: parseDate(inv.valuationDate), amount: Number(inv.currentValuation) || 0 });
    }
  }
  const portfolioXIRR = computeXIRR(signedFlows);
  const portfolioXNPV = (settings.xnpvDiscountRate != null && settings.xnpvDiscountRate !== '')
    ? computeXNPV(signedFlows, Number(settings.xnpvDiscountRate)) : null;

  // Allocation by type and by status (by invested capital).
  const allocationByType = {};
  const allocationByStatus = {};
  for (const it of items) {
    const p = it.analysis.performance;
    const type = it.investment.type || 'real_estate';
    const status = it.investment.status || 'Active';
    allocationByType[type] = (allocationByType[type] || 0) + p.netInvestedCapital;
    allocationByStatus[status] = (allocationByStatus[status] || 0) + p.netInvestedCapital;
  }

  // Portfolio XIRR is a money-weighted return over the combined cash-flow stream
  // where each Active investment's terminal is recognized at its own valuation
  // date. We do NOT extrapolate terminals to a common date (would fabricate data).
  // Instead we expose an explicit reporting/as-of context: the latest valuation
  // date among active investments, plus whether valuation dates are unified.
  const activeTerminalItems = items
    .filter(it => !it.analysis.isClosed && (Number(it.investment.currentValuation) || 0) > 0);
  const activeValuationDates = activeTerminalItems.map(it => it.investment.valuationDate).filter(Boolean);
  const distinctValuationDates = [...new Set(activeValuationDates)];
  const reportingAsOf = activeValuationDates.length ? activeValuationDates.slice().sort().slice(-1)[0] : null;
  const valuationDateMode = distinctValuationDates.length <= 1 ? 'single' : 'multiple';
  const portfolioXIRRMode = 'combined-dated';

  const warnings = [];
  if (distinctValuationDates.length > 1) {
    warnings.push(`Portfolio XIRR recognizes each active investment's terminal at its own valuation date (${distinctValuationDates.join(', ')}). It is a money-weighted return over the combined cash-flow stream, not a return as of a single common date (as-of ${reportingAsOf}).`);
  }
  if (portfolioXIRR == null) {
    warnings.push('Portfolio XIRR is N/A: no sign change across the combined cash-flow stream (only outflows, or only inflows).');
  }

  return {
    items,
    totals: {
      count: items.length,
      totalInvestedCapital, totalEconomicValue, totalGain,
      totalRealInvested, totalRealGain,
      portfolioROI, portfolioMOIC, portfolioRealReturn,
      portfolioXIRR, portfolioXNPV,
    },
    allocationByType, allocationByStatus,
    reportingAsOf, valuationDateMode, portfolioXIRRMode, valuationDates: distinctValuationDates,
    warnings,
  };
}

export function typeLabel(type) {
  return (INVESTMENT_TYPES[type] || { label: type || 'Unknown' }).label;
}