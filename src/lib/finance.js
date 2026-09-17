import * as D from './decimal';

// ---------- Date helpers ----------
export function parseDate(s) { return new Date(s + 'T00:00:00Z'); }
export function daysBetween(d1, d2) { return (d2 - d1) / 86400000; }
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function sortDates(dates) { return [...dates].sort((a, b) => parseDate(a) - parseDate(b)); }

// ---------- Date resolution policy ----------
// availableDates: array of 'YYYY-MM-DD' strings (will be sorted internally)
export function resolveDate(requested, availableDates, policy) {
  const dates = sortDates(availableDates);
  const req = parseDate(requested);
  if (dates.length === 0) return { date: null, exact: false, warning: 'No data available' };

  if (policy === 'exact') {
    if (dates.includes(requested)) return { date: requested, exact: true };
    return { date: null, exact: false, warning: `No data for exact date ${requested}` };
  }
  if (policy === 'previous') {
    let best = null;
    for (const d of dates) {
      if (parseDate(d) <= req) best = d; else break;
    }
    if (!best) return { date: null, exact: false, warning: `No data on or before ${requested}` };
    return { date: best, exact: best === requested, warning: best === requested ? null : `Used ${best} (policy: previous)` };
  }
  if (policy === 'nearest') {
    let best = dates[0], bestDist = Infinity;
    for (const d of dates) {
      const dist = Math.abs(daysBetween(req, parseDate(d)));
      if (dist < bestDist) { bestDist = dist; best = d; } // strict < keeps earlier date on tie
    }
    return { date: best, exact: best === requested, warning: best === requested ? null : `Used ${best} (policy: nearest)` };
  }
  return { date: null, exact: false, warning: 'Unknown date policy' };
}

// ---------- Eligibility ----------
export function eligibleCashFlows(cashFlows, valuationDate) {
  const v = parseDate(valuationDate);
  return cashFlows
    .filter(c => c.status === 'paid')
    .filter(c => parseDate(c.date) < v)
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
}

export function sumAmounts(flows) {
  return flows.reduce((acc, c) => D.add(acc, c.amount), 0n);
}

// ---------- Gold comparison ----------
// gold: [{ date, karat, unit, ask, bid, ... }]
// Uses ASK at payment date (investor buys gold), BID at valuation date (investor sells gold).
export function goldComparison(flows, gold, valuationDate, policy, goldType = '21K') {
  const relevant = gold.filter(g => g.karat === goldType);
  const dates = relevant.map(g => g.date);
  const byDate = new Map(relevant.map(g => [g.date, g]));
  const valResolved = resolveDate(valuationDate, dates, policy);
  const audit = [];
  const warnings = [];
  const rows = [];
  let totalQty = 0n, totalPaid = 0n;
  let complete = true;

  for (const cf of flows) {
    const payResolved = resolveDate(cf.date, dates, policy);
    if (!payResolved.date) {
      complete = false;
      const w = `No gold price resolvable for ${cf.date} (${payResolved.warning})`;
      warnings.push(w);
      rows.push({ cf, warning: w, complete: false });
      audit.push({ calculationType: 'Gold', paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: null, policy, side: 'Ask', appliedPrice: null, units: null, valuationDate, valuationPrice: null, liquidationValue: null, formula: 'amount / goldAsk', result: null, warnings: [w] });
      continue;
    }
    const g = byDate.get(payResolved.date);
    if (!g || !(g.ask > 0)) {
      complete = false;
      const w = `Gold ask price missing/invalid for ${payResolved.date}`;
      warnings.push(w);
      rows.push({ cf, appliedDate: payResolved.date, warning: w, complete: false });
      audit.push({ calculationType: 'Gold', paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: payResolved.date, policy, side: 'Ask', appliedPrice: g?.ask ?? null, units: null, valuationDate, valuationPrice: null, liquidationValue: null, formula: 'amount / goldAsk', result: null, warnings: [w] });
      continue;
    }
    const qty = D.div(cf.amount, g.ask);
    totalQty = D.add(totalQty, qty);
    totalPaid = D.add(totalPaid, cf.amount);
    const w = payResolved.warning;
    if (w) warnings.push(`${cf.date}: ${w}`);
    rows.push({ cf, appliedDate: payResolved.date, goldAsk: g.ask, qty, warning: w, complete: true });
    audit.push({ calculationType: 'Gold', paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: payResolved.date, policy, side: 'Ask', appliedPrice: g.ask, units: qty, valuationDate, valuationPrice: null, liquidationValue: null, formula: 'goldQty = amount / goldAsk', result: qty, warnings: w ? [w] : [] });
  }

  let valBid = null, liquidation = 0n, valDate = valResolved.date;
  if (valResolved.date) {
    const vg = byDate.get(valResolved.date);
    if (vg && vg.bid > 0) {
      valBid = vg.bid;
      liquidation = D.mul(totalQty, vg.bid);
      if (valResolved.warning) warnings.push(`Valuation: ${valResolved.warning}`);
    } else {
      complete = false;
      warnings.push(`Gold bid price missing/invalid for valuation ${valResolved.date}`);
    }
  } else {
    complete = false;
    warnings.push(valResolved.warning);
  }

  const gain = D.sub(liquidation, totalPaid);
  const returnFraction = D.gt(totalPaid, 0) ? D.sub(D.div(liquidation, totalPaid), 1) : 0n;

  audit.push({ calculationType: 'Gold (total)', paymentId: null, paymentDate: null, originalAmount: totalPaid, requestedDate: valuationDate, appliedDate: valDate, policy, side: 'Bid', appliedPrice: valBid, units: totalQty, valuationDate, valuationPrice: valBid, liquidationValue: liquidation, formula: 'liquidation = totalGoldQty * goldBid(valuation)', result: liquidation, warnings: [] });

  return { rows, totalQty, totalPaid, liquidation, valBid, valDate, gain, returnFraction, complete, warnings, audit };
}

// ---------- FX comparison ----------
// fx: [{ date, base, quote, bid, ask }] where base=foreign, quote=EGP
// Buy foreign with EGP => use ASK (EGP per 1 unit foreign). Sell foreign => BID.
export function fxComparison(flows, fx, currency, valuationDate, policy) {
  const relevant = fx.filter(f => f.base === currency && f.quote === 'EGP');
  const dates = relevant.map(f => f.date);
  const byDate = new Map(relevant.map(f => [f.date, f]));
  const valResolved = resolveDate(valuationDate, dates, policy);
  const audit = [];
  const warnings = [];
  const rows = [];
  let totalQty = 0n, totalPaid = 0n;
  let complete = true;

  for (const cf of flows) {
    const payResolved = resolveDate(cf.date, dates, policy);
    if (!payResolved.date) {
      complete = false;
      const w = `No ${currency}/EGP rate for ${cf.date}`;
      warnings.push(w);
      rows.push({ cf, warning: w, complete: false });
      audit.push({ calculationType: `FX ${currency}`, paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: null, policy, side: 'Ask', appliedPrice: null, units: null, valuationDate, valuationPrice: null, liquidationValue: null, formula: `qty = amount / ${currency}Ask`, result: null, warnings: [w] });
      continue;
    }
    const r = byDate.get(payResolved.date);
    if (!r || !(r.ask > 0)) {
      complete = false;
      const w = `${currency}/EGP ask missing for ${payResolved.date}`;
      warnings.push(w);
      rows.push({ cf, appliedDate: payResolved.date, warning: w, complete: false });
      continue;
    }
    const qty = D.div(cf.amount, r.ask);
    totalQty = D.add(totalQty, qty);
    totalPaid = D.add(totalPaid, cf.amount);
    const w = payResolved.warning;
    if (w) warnings.push(`${cf.date}: ${w}`);
    rows.push({ cf, appliedDate: payResolved.date, fxAsk: r.ask, qty, warning: w, complete: true });
    audit.push({ calculationType: `FX ${currency}`, paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: payResolved.date, policy, side: 'Ask', appliedPrice: r.ask, units: qty, valuationDate, valuationPrice: null, liquidationValue: null, formula: `${currency}Qty = amount / ${currency}Ask`, result: qty, warnings: w ? [w] : [] });
  }

  let valBid = null, liquidation = 0n, valDate = valResolved.date;
  if (valResolved.date) {
    const vr = byDate.get(valResolved.date);
    if (vr && vr.bid > 0) {
      valBid = vr.bid;
      liquidation = D.mul(totalQty, vr.bid);
      if (valResolved.warning) warnings.push(`Valuation: ${valResolved.warning}`);
    } else {
      complete = false;
      warnings.push(`${currency}/EGP bid missing for valuation ${valResolved.date}`);
    }
  } else {
    complete = false;
    warnings.push(valResolved.warning);
  }

  const gain = D.sub(liquidation, totalPaid);
  const returnFraction = D.gt(totalPaid, 0) ? D.sub(D.div(liquidation, totalPaid), 1) : 0n;
  audit.push({ calculationType: `FX ${currency} (total)`, paymentId: null, paymentDate: null, originalAmount: totalPaid, requestedDate: valuationDate, appliedDate: valDate, policy, side: 'Bid', appliedPrice: valBid, units: totalQty, valuationDate, valuationPrice: valBid, liquidationValue: liquidation, formula: `liquidation = ${currency}Qty * ${currency}Bid(valuation)`, result: liquidation, warnings: [] });

  return { rows, totalQty, totalPaid, liquidation, valBid, valDate, gain, returnFraction, complete, warnings, audit };
}

// ---------- CPI / inflation ----------
// cpi: [{ effectiveDate, cpiValue, ... }]
export function cpiComparison(flows, cpi, valuationDate, policy) {
  const dates = cpi.map(c => c.effectiveDate);
  const byDate = new Map(cpi.map(c => [c.effectiveDate, c.cpiValue]));
  const valResolved = resolveDate(valuationDate, dates, policy);
  const audit = [];
  const warnings = [];
  const rows = [];
  let totalOriginal = 0n, totalAdjusted = 0n;
  let complete = true;
  let valCpi = null;

  if (valResolved.date) {
    valCpi = byDate.get(valResolved.date);
    if (!(valCpi > 0)) { complete = false; warnings.push(`CPI missing for valuation ${valResolved.date}`); }
    if (valResolved.warning) warnings.push(`Valuation: ${valResolved.warning}`);
  } else {
    complete = false;
    warnings.push(valResolved.warning);
  }

  for (const cf of flows) {
    const payResolved = resolveDate(cf.date, dates, policy);
    if (!payResolved.date) {
      complete = false;
      const w = `No CPI resolvable for ${cf.date}`;
      warnings.push(w);
      rows.push({ cf, warning: w, complete: false });
      audit.push({ calculationType: 'Inflation', paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: null, policy, side: 'n/a', appliedPrice: null, units: null, valuationDate, valuationPrice: valCpi, liquidationValue: null, formula: 'adjusted = amount * cpiVal / cpiPay', result: null, warnings: [w] });
      continue;
    }
    const payCpi = byDate.get(payResolved.date);
    if (!(payCpi > 0)) {
      complete = false;
      const w = `CPI missing/invalid for ${payResolved.date}`;
      warnings.push(w);
      rows.push({ cf, appliedDate: payResolved.date, warning: w, complete: false });
      continue;
    }
    const factor = valCpi > 0 ? D.div(valCpi, payCpi) : 0n;
    const adjusted = D.mul(cf.amount, factor);
    totalOriginal = D.add(totalOriginal, cf.amount);
    totalAdjusted = D.add(totalAdjusted, adjusted);
    const w = payResolved.warning;
    if (w) warnings.push(`${cf.date}: ${w}`);
    rows.push({ cf, appliedDate: payResolved.date, payCpi, valCpi, factor, adjusted, warning: w, complete: true });
    audit.push({ calculationType: 'Inflation', paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: payResolved.date, policy, side: 'n/a', appliedPrice: payCpi, units: null, valuationDate, valuationPrice: valCpi, liquidationValue: adjusted, formula: 'adjusted = amount * cpiVal / cpiPay', result: adjusted, warnings: w ? [w] : [] });
  }

  const gain = D.sub(totalAdjusted, totalOriginal);
  const returnFraction = D.gt(totalOriginal, 0) ? D.sub(D.div(totalAdjusted, totalOriginal), 1) : 0n;
  audit.push({ calculationType: 'Inflation (total)', paymentId: null, paymentDate: null, originalAmount: totalOriginal, requestedDate: valuationDate, appliedDate: valResolved.date, policy, side: 'n/a', appliedPrice: null, units: null, valuationDate, valuationPrice: valCpi, liquidationValue: totalAdjusted, formula: 'sum of adjusted payments', result: totalAdjusted, warnings: [] });

  return { rows, totalOriginal, totalAdjusted, valCpi, valDate: valResolved.date, gain, returnFraction, complete, warnings, audit };
}

// ---------- Property metrics ----------
export function propertyMetrics(flows, currentValuation, valuationDate) {
  const totalPaid = sumAmounts(flows);
  const nominalGain = D.sub(currentValuation, totalPaid);
  const nominalReturnFraction = D.gt(totalPaid, 0) ? D.sub(D.div(currentValuation, totalPaid), 1) : 0n;
  return { totalPaid, currentValuation, nominalGain, nominalReturnFraction };
}

// ---------- XIRR ----------
// flows: [{ date: Date, amount: number }] with sign changes. Returns annualized rate or null.
export function xirr(flows, currentValuation, valuationDate) {
  const eligible = flows.map(c => ({ date: parseDate(c.date), amount: -Number(c.amount) }));
  eligible.push({ date: parseDate(valuationDate), amount: Number(currentValuation) });
  eligible.sort((a, b) => a.date - b.date);
  if (eligible.length < 2) return null;
  const hasPos = eligible.some(f => f.amount > 0);
  const hasNeg = eligible.some(f => f.amount < 0);
  if (!hasPos || !hasNeg) return null;

  const t0 = eligible[0].date;
  const npv = (rate) => {
    let sum = 0;
    for (const f of eligible) {
      const years = daysBetween(t0, f.date) / 365;
      sum += f.amount / Math.pow(1 + rate, years);
    }
    return sum;
  };

  // Bisection between -0.999 and 10
  let lo = -0.999, hi = 10;
  let fLo = npv(lo), fHi = npv(hi);
  if (Number.isNaN(fLo) || Number.isNaN(fHi)) return null;
  // ensure sign difference
  if (fLo * fHi > 0) {
    // expand search
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

// ---------- XNPV ----------
export function xnpv(flows, currentValuation, valuationDate, rate) {
  const eligible = flows.map(c => ({ date: parseDate(c.date), amount: -Number(c.amount) }));
  eligible.push({ date: parseDate(valuationDate), amount: Number(currentValuation) });
  eligible.sort((a, b) => a.date - b.date);
  if (eligible.length === 0) return null;
  const t0 = eligible[0].date;
  let sum = 0;
  for (const f of eligible) {
    const years = daysBetween(t0, f.date) / 365;
    sum += f.amount / Math.pow(1 + rate, years);
  }
  return sum;
}

// ---------- Master analysis ----------
export function analyze({ investment, cashFlows, gold, fx, cpi, settings }) {
  const audit = [];
  const warnings = [];
  const valuationDate = investment.valuationDate;
  const policy = settings.defaultDatePolicy;
  const eligible = eligibleCashFlows(cashFlows, valuationDate);

  if (investment.purchaseCurrency && investment.purchaseCurrency !== 'EGP') {
    warnings.push(`Comparisons assume EGP; payments are in ${investment.purchaseCurrency}. Convert to EGP for accurate comparison.`);
  }

  const prop = propertyMetrics(eligible, investment.currentValuation, valuationDate);
  const xirrVal = xirr(eligible, investment.currentValuation, valuationDate);
  const xnpvVal = settings.xnpvDiscountRate != null && settings.xnpvDiscountRate !== ''
    ? xnpv(eligible, investment.currentValuation, valuationDate, Number(settings.xnpvDiscountRate))
    : null;

  const goldRes = goldComparison(eligible, gold, valuationDate, policy, settings.defaultGoldType);
  const fxResults = {};
  for (const cur of (settings.enabledCurrencies || [])) {
    fxResults[cur] = fxComparison(eligible, fx, cur, valuationDate, policy);
  }
  const cpiRes = cpiComparison(eligible, cpi, valuationDate, policy);

  audit.push(...goldRes.audit, ...cpiRes.audit);
  for (const cur of Object.keys(fxResults)) audit.push(...fxResults[cur].audit);
  warnings.push(...goldRes.warnings, ...cpiRes.warnings);
  for (const cur of Object.keys(fxResults)) warnings.push(...fxResults[cur].warnings);

  // Eligibility audit for excluded payments
  const excluded = cashFlows.filter(c => c.status === 'paid' && !(parseDate(c.date) < parseDate(valuationDate)));
  for (const cf of excluded) {
    audit.unshift({ calculationType: 'Eligibility', paymentId: cf.id, paymentDate: cf.date, originalAmount: cf.amount, requestedDate: cf.date, appliedDate: null, policy, side: 'n/a', appliedPrice: null, units: null, valuationDate, valuationPrice: null, liquidationValue: null, formula: 'eligible if status=paid AND date < valuationDate', result: null, warnings: [`Payment ${cf.date} is on or after valuation date ${valuationDate}; excluded from valuation`] });
  }

  const dataQuality = {
    gold: goldRes.complete ? 'Complete' : 'Missing/Partial',
    cpi: cpiRes.complete ? 'Complete' : 'Missing/Partial',
    cashFlows: excluded.length === 0 ? 'Valid' : 'Issues',
  };
  for (const cur of Object.keys(fxResults)) {
    dataQuality[cur] = fxResults[cur].complete ? 'Complete' : 'Missing/Partial';
  }

  return {
    eligible, excluded, prop, xirrVal, xnpvVal,
    gold: goldRes, fx: fxResults, cpi: cpiRes,
    audit, warnings, dataQuality,
  };
}