// Portfolio-wide Data Quality Control Center — aggregates the existing governance
// engine (checkInvestment + checkMarketData) and each investment's benchmark
// completeness into a prioritized, navigable issue list. No recalculation; the
// performance/governance engines remain the single source of truth.
import { checkInvestment, checkMarketData, rollupStatus, SEVERITY, dateGapStatus } from './governance';
import { parseDate, daysBetween, resolveDate } from './finance';

const RANK = { BLOCKING: 3, ERROR: 2, WARNING: 1, INFO: 0 };

export function buildDataQuality(state, allAnalyses) {
  const issues = [];

  for (const { investment: inv, analysis } of allAnalyses) {
    const txs = (state.cashflows || []).filter(c => c.investmentId === inv.id);
    const invIssues = checkInvestment(inv, txs, { gold: state.gold, fx: state.fx, cpi: state.cpi, customBenchmarks: state.customBenchmarks }, state.settings);
    for (const iss of invIssues) issues.push({ ...iss, investmentName: inv.name, investmentType: inv.type, valuationDate: inv.valuationDate });

    for (const [id, b] of Object.entries(analysis.benchmarks || {})) {
      if (!b.complete) {
        issues.push({
          code: 'BENCH001', severity: SEVERITY.WARNING, category: 'Benchmark',
          investmentId: inv.id, investmentName: inv.name, investmentType: inv.type, valuationDate: inv.valuationDate,
          message: `Benchmark "${b.label}" incomplete for ${inv.name}`,
          reason: (b.warnings || []).join('; ') || 'Some outflows could not be resolved against this benchmark.',
          action: 'Import the missing market data or widen the date range.', blocksAnalysis: false,
        });
      }
    }
  }

  for (const iss of checkMarketData(state)) issues.push({ ...iss, investmentName: null });

  const missing = detectMissingData(allAnalyses);
  const gaps = detectDateGaps(state, allAnalyses);

  issues.sort((a, b) => (RANK[b.severity] || 0) - (RANK[a.severity] || 0));

  return {
    issues,
    missing,
    gaps,
    status: rollupStatus(issues),
    counts: {
      BLOCKING: issues.filter(i => i.severity === 'BLOCKING').length,
      ERROR: issues.filter(i => i.severity === 'ERROR').length,
      WARNING: issues.filter(i => i.severity === 'WARNING').length,
      INFO: issues.filter(i => i.severity === 'INFO').length,
    },
  };
}

function detectMissingData(allAnalyses) {
  const out = { gold: 0, fx: 0, cpi: 0, custom: 0 };
  for (const { analysis } of allAnalyses) {
    if (!analysis.benchmarks) continue;
    for (const [id, b] of Object.entries(analysis.benchmarks)) {
      if (!b.complete) {
        if (id === 'gold') out.gold++;
        else if (id.startsWith('fx:')) out.fx++;
        else if (id === 'cpi') out.cpi++;
        else if (id.startsWith('custom:')) out.custom++;
      }
    }
  }
  return out;
}

function detectDateGaps(state, allAnalyses) {
  const gaps = [];
  const policy = state.settings.defaultDatePolicy;
  const goldDates = (state.gold || []).filter(g => g.karat === (state.settings.defaultGoldType || '21K')).map(g => g.date);
  const cpiDates = (state.cpi || []).map(c => c.effectiveDate);
  for (const { investment: inv, analysis } of allAnalyses) {
    const elig = analysis.eligible || [];
    if (!elig.length) continue;
    for (const [bench, dates] of [['Gold', goldDates], ['CPI', cpiDates]]) {
      if (!dates.length) continue;
      let maxGap = 0, gapPayDate = null, gapApplied = null;
      for (const t of elig) {
        const r = resolveDate(t.date, dates, policy);
        if (r.date && !r.exact) {
          const d = Math.abs(daysBetween(parseDate(t.date), parseDate(r.date)));
          if (d > maxGap) { maxGap = d; gapPayDate = t.date; gapApplied = r.date; }
        }
      }
      if (maxGap > 0) {
        const g = dateGapStatus(maxGap);
        gaps.push({
          investmentId: inv.id, investmentName: inv.name, benchmark: bench,
          paymentDate: gapPayDate, appliedDate: gapApplied, gapDays: maxGap,
          classification: g.label, severity: g.status === 'INCOMPLETE' ? 'ERROR' : 'WARNING',
        });
      }
    }
  }
  return gaps;
}