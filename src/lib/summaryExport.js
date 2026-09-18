// Exportable analysis summary — portable CSV rows for an investment or the
// portfolio. Reads only already-computed analysis.performance / benchmarks /
// governance; no recalculation. Reuses the same formatters as the UI.
import { INVESTMENT_TYPES, CLOSED_STATUSES } from './model';

export function investmentSummaryRows(analysis, investment) {
  const p = analysis.performance;
  const rows = [];
  const push = (label, value) => rows.push([label, value]);
  push('Investment', investment.name);
  push('Type', (INVESTMENT_TYPES[investment.type] || {}).label || investment.type || '');
  push('Status', investment.status || 'Active');
  push('Closed', CLOSED_STATUSES.includes(investment.status) ? 'Yes' : 'No');
  push('Base currency', investment.baseCurrency || 'EGP');
  push('Valuation date', investment.valuationDate || '');
  push('Invested capital', p.netInvestedCapital);
  push('Economic / current value', p.totalEconomicValue);
  push('Gain / loss', p.gain);
  push('ROI', p.simpleROI != null ? p.simpleROI : '');
  push('MOIC', p.netInvestedCapital > 0 ? p.moic : '');
  push('XIRR', p.xirrVal != null ? p.xirrVal : 'N/A');
  push('Annualized return', p.annualizedReturn != null ? p.annualizedReturn : 'N/A');
  push('Real return', p.realInvestedCapital > 0 ? p.realReturn : 'N/A');
  push('Real invested capital', p.realInvestedCapital);
  push('Governance status', analysis.governance?.status || '');
  for (const [id, b] of Object.entries(analysis.benchmarks || {})) {
    push(`Benchmark: ${b.label} — value`, b.complete ? b.value : 'N/A');
    push(`Benchmark: ${b.label} — opportunity cost`, b.complete ? b.opportunityCost : 'N/A');
  }
  return rows;
}

export function portfolioSummaryRows(portfolio, state) {
  const t = portfolio.totals;
  const rows = [];
  const push = (label, value) => rows.push([label, value]);
  push('Portfolio reporting / as-of date', portfolio.reportingAsOf || '');
  push('Valuation-date mode', portfolio.valuationDateMode || 'single');
  push('Investment valuation dates', (portfolio.valuationDates || []).join(', '));
  push('Investments', t.count);
  push('Invested capital', t.totalInvestedCapital);
  push('Economic value', t.totalEconomicValue);
  push('Gain / loss', t.totalGain);
  push('Portfolio ROI', t.portfolioROI);
  push('Portfolio MOIC', t.totalInvestedCapital > 0 ? t.portfolioMOIC : '');
  push('Portfolio XIRR', t.portfolioXIRR != null ? t.portfolioXIRR : 'N/A');
  push('Portfolio XIRR mode', portfolio.portfolioXIRRMode || 'combined-dated');
  push('Real return', t.totalRealInvested > 0 ? t.portfolioRealReturn : 'N/A');
  for (const [type, val] of Object.entries(portfolio.allocationByType || {})) push(`Allocation: ${type}`, val);
  for (const [status, val] of Object.entries(portfolio.allocationByStatus || {})) push(`Allocation by status: ${status}`, val);
  return rows;
}