// Centralized performance engine — universal metrics for any investment type.
// Reuses the existing Gold / FX / CPI comparison functions from finance.js
// (preserving Ask/Bid and date-policy rules) and layers universal metrics on top.
import * as D from './decimal';
import { parseDate, daysBetween, goldComparison, fxComparison, cpiComparison } from './finance';
import { eligibleTransactions, outflows, inflows, capitalReturns, signedAmount, sum } from './transactions';
import { benchmarkRegistry, evaluateBenchmark } from './benchmarks';
import { checkInvestment, rollupStatus } from './governance';
import { CLOSED_STATUSES } from './model';

// XIRR over signed flows [{date: Date, amount: number}] with a sign change.
// Exported so portfolio aggregation and scenarios reuse the same formula.
export function computeXIRR(signedFlows) {
  const eligible = [...signedFlows].sort((a, b) => a.date - b.date);
  if (eligible.length < 2) return null;
  const hasPos = eligible.some(f => f.amount > 0);
  const hasNeg = eligible.some(f => f.amount < 0);
  if (!hasPos || !hasNeg) return null;
  const t0 = eligible[0].date;
  const npv = (rate) => {
    let s = 0;
    for (const f of eligible) {
      const years = daysBetween(t0, f.date) / 365;
      s += f.amount / Math.pow(1 + rate, years);
    }
    return s;
  };
  let lo = -0.999, hi = 10, fLo = npv(lo), fHi = npv(hi);
  if (Number.isNaN(fLo) || Number.isNaN(fHi)) return null;
  if (fLo * fHi > 0) {
    let found = false;
    for (let r = -0.99; r <= 10; r += 0.01) {
      const v = npv(r);
      if (fLo * v < 0) { hi = r; fHi = v; found = true; break; }
    }
    if (!found) return null;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; }
    else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

export function computeXNPV(signedFlows, rate) {
  const eligible = [...signedFlows].sort((a, b) => a.date - b.date);
  if (!eligible.length) return null;
  const t0 = eligible[0].date;
  let s = 0;
  for (const f of eligible) {
    const years = daysBetween(t0, f.date) / 365;
    s += f.amount / Math.pow(1 + rate, years);
  }
  return s;
}

// Main entry. Returns a superset of the legacy analyze() shape so existing
// pages keep working, plus `performance`, `benchmarks` and `governance`.
export function analyzeInvestment({ investment, transactions, gold, fx, cpi, customBenchmarks, settings }) {
  const audit = [];
  const warnings = [];
  const valuationDate = investment.valuationDate;
  const policy = settings.defaultDatePolicy;
  const state = { gold, fx, cpi, customBenchmarks };
  const isClosed = CLOSED_STATUSES.includes(investment.status);

  const eligible = eligibleTransactions(transactions, valuationDate);
  const eligOut = outflows(eligible);
  const eligIn = inflows(eligible);
  const capReturns = capitalReturns(eligible);

  const totalOutflows = sum(eligOut);
  const totalInflows = sum(eligIn);
  const capitalReturned = sum(capReturns);
  const netInvestedCapital = totalOutflows - capitalReturned;
  const currentValue = isClosed ? 0 : (Number(investment.currentValuation) || 0);
  const totalEconomicValue = isClosed ? totalInflows : currentValue + totalInflows;
  const gain = totalEconomicValue - netInvestedCapital;
  const simpleROI = netInvestedCapital > 0 ? gain / netInvestedCapital : 0;
  const moic = netInvestedCapital > 0 ? totalEconomicValue / netInvestedCapital : 0;

  // XIRR / XNPV over signed economic cash flows + terminal value.
  const signed = eligible.map(t => ({ date: parseDate(t.date), amount: signedAmount(t) }));
  if (!isClosed && currentValue > 0) signed.push({ date: parseDate(valuationDate), amount: currentValue });
  const xirrVal = computeXIRR(signed);
  const xnpvVal = (settings.xnpvDiscountRate != null && settings.xnpvDiscountRate !== '')
    ? computeXNPV(signed, Number(settings.xnpvDiscountRate)) : null;

  // Annualized return (CAGR-style from MOIC over holding period).
  let years = null, annualizedReturn = null;
  if (eligible.length) {
    years = daysBetween(parseDate(eligible[0].date), parseDate(valuationDate)) / 365;
    if (years > 0 && moic > 0 && netInvestedCapital > 0) annualizedReturn = Math.pow(moic, 1 / years) - 1;
  }

  // CPI / real return (uses outflows only — same-cash-flow principle).
  const cpiRes = cpiComparison(eligOut, cpi, valuationDate, policy);
  const realInvestedCapital = D.toNumber(cpiRes.totalAdjusted);
  const realGain = totalEconomicValue - realInvestedCapital;
  const realReturn = realInvestedCapital > 0 ? realGain / realInvestedCapital : 0;

  // Legacy Gold / FX breakdowns (preserve existing detail + audit).
  const goldRes = goldComparison(eligOut, gold, valuationDate, policy, settings.defaultGoldType);
  const fxResults = {};
  for (const cur of (settings.enabledCurrencies || [])) {
    fxResults[cur] = fxComparison(eligOut, fx, cur, valuationDate, policy);
  }

  // Universal benchmarks (gold / fx / cpi / fixed / custom) with opportunity cost.
  const registry = benchmarkRegistry(settings, state);
  const benchmarks = {};
  for (const b of registry) {
    const r = evaluateBenchmark(b, eligOut, state, valuationDate, policy);
    benchmarks[b.id] = { ...r, opportunityCost: r.value - totalEconomicValue };
    audit.push(...(r.audit || []));
    warnings.push(...(r.warnings || []));
  }

  // Eligibility exclusions audit.
  const excluded = (transactions || []).filter(t => t.status === 'paid' && !(parseDate(t.date) < parseDate(valuationDate)));
  for (const t of excluded) {
    audit.unshift({
      calculationType: 'Eligibility', paymentId: t.id, paymentDate: t.date, originalAmount: t.amount,
      requestedDate: t.date, appliedDate: null, policy, side: 'n/a', appliedPrice: null, units: null,
      valuationDate, valuationPrice: null, liquidationValue: null,
      formula: 'eligible if status=paid AND date < valuationDate', result: null,
      warnings: [`Transaction ${t.date} is on or after valuation date ${valuationDate}; excluded from valuation`],
    });
  }

  // Legacy-compat fields (same types as before so existing pages render unchanged).
  const prop = {
    totalPaid: D.D(totalOutflows),
    currentValuation: D.D(currentValue),
    nominalGain: D.D(gain),
    nominalReturnFraction: D.D(simpleROI),
  };

  const dataQuality = {
    gold: goldRes.complete ? 'Complete' : 'Missing/Partial',
    cpi: cpiRes.complete ? 'Complete' : 'Missing/Partial',
    cashFlows: excluded.length === 0 ? 'Valid' : 'Issues',
  };
  for (const cur of Object.keys(fxResults)) {
    dataQuality[cur] = fxResults[cur].complete ? 'Complete' : 'Missing/Partial';
  }

  const performance = {
    totalOutflows, totalInflows, capitalReturned, netInvestedCapital,
    currentValue, totalEconomicValue, gain, simpleROI, moic,
    xirrVal, xnpvVal, annualizedReturn, years,
    realInvestedCapital, realGain, realReturn,
  };

  const govIssues = checkInvestment(investment, transactions, { gold, fx, cpi, customBenchmarks }, settings);
  const governance = { issues: govIssues, status: rollupStatus(govIssues) };

  return {
    // legacy
    eligible, excluded, prop, xirrVal, xnpvVal,
    gold: goldRes, fx: fxResults, cpi: cpiRes,
    audit, warnings, dataQuality,
    // new
    performance, benchmarks, governance, isClosed,
  };
}