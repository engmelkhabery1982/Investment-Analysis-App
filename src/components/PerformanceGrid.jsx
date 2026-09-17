import MetricCard from './MetricCard';
import { fmtMoney, fmtPct } from '@/lib/format';

// Universal performance metrics grid — consumes analysis.performance only.
// No recalculation. Renders only metrics that are meaningful for the investment.
export default function PerformanceGrid({ analysis, currency = 'EGP' }) {
  const p = analysis.performance;
  const cur = currency;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard label="Invested capital" value={fmtMoney(p.netInvestedCapital, 2, cur)} />
      <MetricCard label="Current / economic value" value={fmtMoney(p.totalEconomicValue, 2, cur)} />
      <MetricCard label="Gain / loss" value={fmtMoney(p.gain, 2, cur)} tone={p.gain > 0 ? 'pos' : p.gain < 0 ? 'neg' : ''} />
      <MetricCard label="ROI" value={fmtPct(p.simpleROI)} tone={p.simpleROI > 0 ? 'pos' : p.simpleROI < 0 ? 'neg' : ''} />
      <MetricCard label="MOIC" value={p.netInvestedCapital > 0 ? (p.moic.toFixed(2) + 'x') : 'N/A'} />
      <MetricCard label="XIRR (annualized)" value={p.xirrVal != null ? fmtPct(p.xirrVal) : 'N/A'} sub={p.xirrVal == null ? 'No sign change / N/A' : ''} />
      <MetricCard label="Annualized return" value={p.annualizedReturn != null ? fmtPct(p.annualizedReturn) : 'N/A'} />
      <MetricCard label="Real return (inflation-adj.)" value={p.realInvestedCapital > 0 ? fmtPct(p.realReturn) : 'N/A'} tone={p.realReturn > 0 ? 'pos' : p.realReturn < 0 ? 'neg' : ''} />
    </div>
  );
}