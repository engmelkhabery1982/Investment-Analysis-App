// Universal benchmark engine. Generalizes the existing Gold / FX / CPI comparison
// into a single "benchmark" concept and adds Fixed-Return and Custom benchmarks.
// Existing Gold Ask-purchase / Bid-liquidation and FX Ask/Bid rules are reused
// unchanged from finance.js — this module only dispatches and normalizes results.
import * as D from './decimal';
import { parseDate, daysBetween, resolveDate, goldComparison, fxComparison, cpiComparison } from './finance';

export const BENCHMARK_TYPES = { market: 'market', inflation: 'inflation', fixed: 'fixed' };

// Build the list of enabled benchmarks from settings + state.
export function benchmarkRegistry(settings, state) {
  const list = [];
  list.push({ id: 'gold', label: `Gold (${settings.defaultGoldType || '21K'})`, type: 'market', subtype: 'gold', karat: settings.defaultGoldType || '21K' });
  for (const cur of (settings.enabledCurrencies || [])) {
    list.push({ id: `fx:${cur}`, label: cur, type: 'market', subtype: 'fx', currency: cur });
  }
  list.push({ id: 'cpi', label: 'Inflation (CPI)', type: 'inflation', subtype: 'cpi' });
  const rate = Number(settings.fixedReturnRate);
  if (Number.isFinite(rate) && settings.fixedReturnRate !== '' && settings.fixedReturnRate != null) {
    list.push({
      id: 'fixed',
      label: `Fixed Return (${(rate * 100).toFixed(2)}%)`,
      type: 'fixed', subtype: 'fixed', rate, compounding: settings.fixedReturnCompounding || 'annual',
    });
  }
  for (const cb of (state.customBenchmarks || [])) {
    list.push({ id: `custom:${cb.id}`, label: cb.name, type: 'market', subtype: 'custom', benchmarkId: cb.id, currency: cb.currency });
  }
  return list;
}

// Evaluate one benchmark against a set of outflows (same-cash-flow principle).
// Returns { id, label, type, subtype, value, invested, gain, returnFraction, complete, warnings, audit }.
export function evaluateBenchmark(bench, outflowsArr, state, valuationDate, policy) {
  const flows = outflowsArr || [];
  if (bench.subtype === 'gold') {
    const res = goldComparison(flows, state.gold || [], valuationDate, policy, bench.karat);
    return toResult(bench, D.toNumber(res.liquidation), D.toNumber(res.totalPaid), res.complete, res.warnings, res.audit);
  }
  if (bench.subtype === 'fx') {
    const res = fxComparison(flows, state.fx || [], bench.currency, valuationDate, policy);
    return toResult(bench, D.toNumber(res.liquidation), D.toNumber(res.totalPaid), res.complete, res.warnings, res.audit);
  }
  if (bench.subtype === 'cpi') {
    const res = cpiComparison(flows, state.cpi || [], valuationDate, policy);
    return toResult(bench, D.toNumber(res.totalAdjusted), D.toNumber(res.totalOriginal), res.complete, res.warnings, res.audit, 'inflation');
  }
  if (bench.subtype === 'fixed') {
    const n = bench.compounding === 'monthly' ? 12 : 1;
    let value = 0, invested = 0; const warnings = []; const audit = [];
    for (const cf of flows) {
      const years = daysBetween(parseDate(cf.date), parseDate(valuationDate)) / 365;
      if (years < 0) { warnings.push(`${cf.date} is after valuation date`); continue; }
      const fv = (Number(cf.amount) || 0) * Math.pow(1 + bench.rate / n, n * years);
      value += fv; invested += Number(cf.amount) || 0;
      audit.push({ calculationType: 'Fixed Return', paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: cf.date, policy, side: 'n/a', appliedPrice: bench.rate, units: null, valuationDate, valuationPrice: null, liquidationValue: fv, formula: `FV = amount * (1 + r/n)^(n*years), r=${bench.rate}, n=${n}`, result: fv, warnings: [] });
    }
    audit.push({ calculationType: 'Fixed Return (total)', paymentId: null, paymentDate: null, originalAmount: invested, requestedDate: valuationDate, appliedDate: valuationDate, policy, side: 'n/a', appliedPrice: bench.rate, units: null, valuationDate, valuationPrice: null, liquidationValue: value, formula: 'sum of FV per outflow', result: value, warnings: [] });
    return toResult(bench, value, invested, true, warnings, audit);
  }
  if (bench.subtype === 'custom') {
    const series = (state.customBenchmarks || []).find(b => b.id === bench.benchmarkId);
    if (!series) return toResult(bench, 0, 0, false, ['Custom benchmark not found'], []);
    const rows = series.data || [];
    const dates = rows.map(r => r.date);
    const byDate = new Map(rows.map(r => [r.date, Number(r.value)]));
    const valRes = resolveDate(valuationDate, dates, policy);
    let qty = 0, invested = 0; const warnings = []; const audit = []; let complete = true;
    for (const cf of flows) {
      const pr = resolveDate(cf.date, dates, policy);
      if (!pr.date) { complete = false; warnings.push(`No ${series.name} data resolvable for ${cf.date}`); continue; }
      const p = byDate.get(pr.date);
      if (!(p > 0)) { complete = false; warnings.push(`${series.name} value missing/invalid for ${pr.date}`); continue; }
      const q = (Number(cf.amount) || 0) / p; qty += q; invested += Number(cf.amount) || 0;
      if (pr.warning) warnings.push(`${cf.date}: ${pr.warning}`);
      audit.push({ calculationType: `Custom: ${series.name}`, paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: pr.date, policy, side: 'Buy', appliedPrice: p, units: q, valuationDate, valuationPrice: null, liquidationValue: null, formula: 'qty = amount / price', result: q, warnings: pr.warning ? [pr.warning] : [] });
    }
    let value = 0, valPrice = null;
    if (valRes.date) {
      valPrice = byDate.get(valRes.date);
      if (valPrice > 0) value = qty * valPrice;
      else { complete = false; warnings.push(`${series.name} value missing for valuation ${valRes.date}`); }
      if (valRes.warning) warnings.push(`Valuation: ${valRes.warning}`);
    } else { complete = false; warnings.push(valRes.warning); }
    audit.push({ calculationType: `Custom: ${series.name} (total)`, paymentId: null, paymentDate: null, originalAmount: invested, requestedDate: valuationDate, appliedDate: valRes.date, policy, side: 'Sell', appliedPrice: valPrice, units: qty, valuationDate, valuationPrice: valPrice, liquidationValue: value, formula: 'value = qty * price(valuation)', result: value, warnings: [] });
    return toResult(bench, value, invested, complete, warnings, audit);
  }
  return toResult(bench, 0, 0, false, ['Unknown benchmark type'], []);
}

function toResult(bench, value, invested, complete, warnings, audit, mode) {
  const gain = value - invested;
  const returnFraction = invested > 0 ? value / invested - 1 : 0;
  return { id: bench.id, label: bench.label, type: bench.type, subtype: bench.subtype, mode, value, invested, gain, returnFraction, complete: !!complete, warnings: warnings || [], audit: audit || [] };
}