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
  };
}

export function typeLabel(type) {
  return (INVESTMENT_TYPES[type] || { label: type || 'Unknown' }).label;
}