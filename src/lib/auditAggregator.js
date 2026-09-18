// Audit aggregator — portfolio-wide. Joins the audit evidence already emitted
// by the verified engines (finance.js / benchmarks.js / performance.js) to its
// inputs (investment, transaction, market-data source). Does NOT recalculate
// anything; it only flattens and enriches emitted audit records for tracing.

function benchmarkLabel(calcType) {
  if (!calcType) return '';
  if (calcType === 'Gold' || calcType === 'Gold (total)') return 'Gold';
  if (calcType.startsWith('FX ')) return calcType.replace(' (total)', '');
  if (calcType === 'Inflation' || calcType === 'Inflation (total)') return 'Inflation (CPI)';
  if (calcType.startsWith('Fixed Return')) return 'Fixed Return';
  if (calcType.startsWith('Custom:')) return calcType.replace(' (total)', '').replace('Custom: ', '').trim();
  if (calcType === 'Eligibility') return 'Eligibility';
  return calcType;
}

// Best-effort lookup of the data source behind an applied market price.
// Pure join on date + price — no recalculation. Empty when not resolvable.
function resolveSource(a, state) {
  if (!a.appliedDate) return '';
  const ct = a.calculationType || '';
  try {
    if (ct === 'Gold' || ct === 'Gold (total)') {
      const g = (state.gold || []).find(x => x.date === a.appliedDate && (x.ask === a.appliedPrice || x.bid === a.appliedPrice));
      return g?.source || '';
    }
    if (ct.startsWith('FX ')) {
      const cur = ct.replace('FX ', '').replace(' (total)', '').trim();
      const f = (state.fx || []).find(x => x.date === a.appliedDate && x.base === cur && (x.ask === a.appliedPrice || x.bid === a.appliedPrice));
      return f?.source || '';
    }
    if (ct === 'Inflation' || ct === 'Inflation (total)') {
      const c = (state.cpi || []).find(x => x.effectiveDate === a.appliedDate);
      return c?.source || '';
    }
    if (ct.startsWith('Custom:')) {
      const name = ct.replace('Custom: ', '').replace(' (total)', '').trim();
      const cb = (state.customBenchmarks || []).find(b => b.name === name);
      const row = cb && (cb.data || []).find(r => r.date === a.appliedDate);
      return (row && row.source) || (cb && cb.source) || '';
    }
  } catch (e) { /* ignore */ }
  return '';
}

function recordStatus(a) {
  if (a.calculationType === 'Eligibility') return 'INFO';
  if (a.warnings && a.warnings.length) return 'WARNING';
  if (a.appliedDate == null) return 'ERROR';
  return 'OK';
}

export function aggregateAudit(state, allAnalyses) {
  const txById = new Map((state.cashflows || []).map(c => [c.id, c]));
  const rows = [];
  for (const { investment: inv, analysis } of allAnalyses) {
    for (const a of analysis.audit || []) {
      const tx = a.paymentId ? txById.get(a.paymentId) : null;
      rows.push({
        investmentId: inv.id,
        investmentName: inv.name,
        investmentType: inv.type || 'real_estate',
        investmentStatus: inv.status || 'Active',
        benchmark: benchmarkLabel(a.calculationType),
        calculationType: a.calculationType,
        paymentId: a.paymentId || '',
        paymentDate: a.paymentDate || '',
        paymentAmount: a.originalAmount != null ? a.originalAmount : '',
        direction: tx?.direction || '',
        transactionType: tx?.transactionType || tx?.paymentType || '',
        requestedDate: a.requestedDate || '',
        appliedDate: a.appliedDate || '',
        policy: a.policy || '',
        side: a.side || '',
        appliedPrice: a.appliedPrice != null ? a.appliedPrice : '',
        units: a.units != null ? a.units : '',
        valuationDate: a.valuationDate || '',
        valuationPrice: a.valuationPrice != null ? a.valuationPrice : '',
        liquidationValue: a.liquidationValue != null ? a.liquidationValue : '',
        result: a.result != null ? a.result : '',
        formula: a.formula || '',
        warnings: (a.warnings || []).join('; '),
        source: resolveSource(a, state),
        status: recordStatus(a),
      });
    }
  }
  return rows;
}

export function filterAudit(rows, { investmentId = 'all', benchmark = 'all', date = '', status = 'all' } = {}) {
  return rows.filter(r => {
    if (investmentId !== 'all' && r.investmentId !== investmentId) return false;
    if (benchmark !== 'all' && r.benchmark !== benchmark) return false;
    if (date && r.paymentDate !== date && r.appliedDate !== date) return false;
    if (status !== 'all' && r.status !== status) return false;
    return true;
  });
}

export function auditCSVRows(rows) {
  const headers = ['Investment', 'Type', 'Status', 'Benchmark', 'Payment date', 'Amount', 'Direction', 'Transaction type', 'Requested date', 'Applied date', 'Policy', 'Side', 'Applied price', 'Units', 'Valuation date', 'Valuation price', 'Liquidation value', 'Result', 'Source', 'Warnings', 'Formula'];
  return [headers, ...rows.map(r => [
    r.investmentName, r.investmentType, r.investmentStatus, r.benchmark,
    r.paymentDate, r.paymentAmount, r.direction, r.transactionType,
    r.requestedDate, r.appliedDate, r.policy, r.side, r.appliedPrice, r.units,
    r.valuationDate, r.valuationPrice, r.liquidationValue, r.result, r.source, r.warnings, r.formula,
  ])];
}