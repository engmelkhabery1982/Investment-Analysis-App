import * as D from './decimal';
import { resolveDate, goldComparison, fxComparison, cpiComparison, eligibleCashFlows } from './finance';
import { parseDelimited, parseClipboard, autoMapColumns, parseDateField, parseNumber, prepareRows, buildRecord, validateImportRow } from './importEngine';
import { signedAmount, eligibleTransactions, outflows, inflows } from './transactions';
import { analyzeInvestment } from './performance';
import { evaluateBenchmark, benchmarkRegistry } from './benchmarks';
import { rollupStatus, dateGapStatus } from './governance';

// Spec test cases. Returns array of { name, passed, detail }.
export function runTests() {
  const results = [];

  function check(name, cond, detail) {
    results.push({ name, passed: !!cond, detail: detail || '' });
  }

  const baseSettings = {
    defaultDatePolicy: 'exact', defaultGoldType: '21K', enabledCurrencies: [],
    xnpvDiscountRate: 0.10, fixedReturnRate: 0.12, fixedReturnCompounding: 'annual',
  };

  // 1. Gold: 100,000 / 4,000 = 25g; 25 * 5,000 = 125,000
  {
    const flows = [{ id: 't1', date: '2024-01-01', amount: 100000, status: 'paid' }];
    const gold = [{ date: '2024-01-01', karat: '21K', ask: 4000, bid: 4000 }, { date: '2025-01-01', karat: '21K', ask: 5000, bid: 5000 }];
    const r = goldComparison(flows, gold, '2025-01-01', 'exact', '21K');
    check('Gold quantity = 25g', Math.abs(D.toNumber(r.totalQty) - 25) < 1e-6, `got ${D.toNumber(r.totalQty)}`);
    check('Gold liquidation = 125,000', Math.abs(D.toNumber(r.liquidation) - 125000) < 1e-6, `got ${D.toNumber(r.liquidation)}`);
  }

  // 2. Inflation: 100,000 * 250 / 200 = 125,000
  {
    const flows = [{ id: 't2', date: '2024-01-01', amount: 100000, status: 'paid' }];
    const cpi = [{ effectiveDate: '2024-01-01', cpiValue: 200 }, { effectiveDate: '2025-01-01', cpiValue: 250 }];
    const r = cpiComparison(flows, cpi, '2025-01-01', 'exact');
    check('Inflation adjusted = 125,000', Math.abs(D.toNumber(r.totalAdjusted) - 125000) < 1e-6, `got ${D.toNumber(r.totalAdjusted)}`);
  }

  // 3. FX: 100,000 / 50 = 2,000 USD; 2,000 * 55 = 110,000
  {
    const flows = [{ id: 't3', date: '2024-01-01', amount: 100000, status: 'paid' }];
    const fx = [{ date: '2024-01-01', base: 'USD', quote: 'EGP', bid: 50, ask: 50 }, { date: '2025-01-01', base: 'USD', quote: 'EGP', bid: 55, ask: 55 }];
    const r = fxComparison(flows, fx, 'USD', '2025-01-01', 'exact');
    check('USD qty = 2,000', Math.abs(D.toNumber(r.totalQty) - 2000) < 1e-6, `got ${D.toNumber(r.totalQty)}`);
    check('USD liquidation = 110,000', Math.abs(D.toNumber(r.liquidation) - 110000) < 1e-6, `got ${D.toNumber(r.liquidation)}`);
  }

  // 4. Nearest tie -> previous date (Jan 1 vs Jan 3, requested Jan 2 => Jan 1)
  {
    const res = resolveDate('2024-01-02', ['2024-01-01', '2024-01-03'], 'nearest');
    check('Nearest tie resolves to previous (Jan 1)', res.date === '2024-01-01', `got ${res.date}`);
  }

  // 5. Invalid payment date (>= valuation date) excluded
  {
    const flows = [
      { id: 'a', date: '2025-01-01', amount: 100, status: 'paid' },
      { id: 'b', date: '2025-06-01', amount: 100, status: 'paid' },
      { id: 'c', date: '2025-07-01', amount: 100, status: 'paid' },
    ];
    const elig = eligibleCashFlows(flows, '2025-06-01');
    check('Payment on/after valuation date excluded', elig.length === 1 && elig[0].id === 'a', `got ${elig.length}`);
  }

  // 6. Decimal safety: 0.1 + 0.2 == 0.3
  {
    const sum = D.add(0.1, 0.2);
    check('Decimal: 0.1 + 0.2 = 0.3', Math.abs(D.toNumber(sum) - 0.3) < 1e-9, `got ${D.toNumber(sum)}`);
  }

  // 7. Previous policy uses nearest on or before
  {
    const res = resolveDate('2024-01-05', ['2024-01-01', '2024-01-03'], 'previous');
    check('Previous policy picks Jan 3', res.date === '2024-01-03', `got ${res.date}`);
  }

  // 8. Previous policy: no future date
  {
    const res = resolveDate('2023-12-31', ['2024-01-01'], 'previous');
    check('Previous policy rejects future-only data', res.date === null, `got ${res.date}`);
  }

  // ---- Import engine tests ----
  // 9. CSV parsing
  {
    const rows = parseDelimited('date,amount\n2024-09-01,500000\n2025-01-15,250000', ',');
    check('CSV parses 3 rows', rows.length === 3 && rows[0][0] === 'date' && rows[2][1] === '250000', `got ${rows.length}`);
  }
  // 10. Tab-separated clipboard parsing
  {
    const { delimiter, rows } = parseClipboard('date\tamount\n2024-09-01\t500000');
    check('TSV parses with tab delimiter', delimiter === '\t' && rows.length === 2 && rows[1][1] === '500000', `got ${delimiter}/${rows.length}`);
  }
  // 11. Column mapping (auto)
  {
    const m = autoMapColumns(['Payment Date', 'Paid Amount', 'Currency'], 'cashflow');
    check('Cash flow columns auto-mapped', m.date === 0 && m.amount === 1 && m.currency === 2, `got ${JSON.stringify(m)}`);
  }
  // 12. Date normalization
  {
    const a = parseDateField('2024-09-01');
    const b = parseDateField('01/09/2024', 'dmy');
    const c = parseDateField('09/01/2024', 'mdy');
    check('ISO date normalized', a.iso === '2024-09-01', `got ${a.iso}`);
    check('DD/MM/YYYY normalized under dmy', b.iso === '2024-09-01', `got ${b.iso}`);
    check('MM/DD/YYYY normalized under mdy', c.iso === '2024-09-01', `got ${c.iso}`);
  }
  // 13. Ambiguous date detection
  {
    const r = parseDateField('03/04/2025', 'auto');
    check('Ambiguous date 03/04 flagged', r.ambiguous === true, `got ${JSON.stringify(r)}`);
    const resolved = parseDateField('03/04/2025', 'dmy');
    check('Ambiguous date resolved under dmy to Apr 3', resolved.iso === '2025-04-03', `got ${resolved.iso}`);
  }
  // 14. Numeric normalization
  {
    const a = parseNumber('100,000.50');
    const b = parseNumber('100.000,50', 'eu');
    const c = parseNumber('100 000', 'auto');
    check('US number 100,000.50 = 100000.5', Math.abs(a.value - 100000.5) < 1e-6, `got ${a.value}`);
    check('EU number 100.000,50 = 100000.5', Math.abs(b.value - 100000.5) < 1e-6, `got ${b.value}`);
    check('Spaced number 100 000 = 100000', Math.abs(c.value - 100000) < 1e-6, `got ${c.value}`);
  }
  // 15. Duplicate detection (within batch)
  {
    const rows = [['2024-09-01', '4000', '4100'], ['2024-09-01', '4000', '4100']];
    const map = { date: 0, ask: 1, bid: 2 };
    const prepared = prepareRows('gold', rows, map, { dateFormat: 'auto', numberFormat: 'auto', settings: {} }, [], {});
    check('Second identical gold row detected as duplicate', prepared[1].status === 'duplicate', `got ${prepared[1].status}`);
  }
  // 16. Conflict detection (against existing)
  {
    const existing = [{ id: 'g-x', date: '2024-09-01', karat: '21K', unit: 'gram', ask: 4000, bid: 4100 }];
    const rows = [['2024-09-01', '4000', '4100']];
    const map = { date: 0, ask: 1, bid: 2 };
    const prepared = prepareRows('gold', rows, map, { dateFormat: 'auto', numberFormat: 'auto', settings: {} }, existing, {});
    check('Row matching existing detected as conflict', prepared[0].status === 'conflict' && prepared[0].existingId === 'g-x', `got ${prepared[0].status}`);
  }
  // 17. Invalid row rejection
  {
    const rows = [['2024-09-01', '0', '4100']];
    const map = { date: 0, ask: 1, bid: 2 };
    const prepared = prepareRows('gold', rows, map, { dateFormat: 'auto', numberFormat: 'auto', settings: {} }, [], {});
    check('Gold ask=0 row rejected with error', prepared[0].status === 'error' && prepared[0].errors.length > 0, `got ${prepared[0].status}/${prepared[0].errors.length}`);
  }
  // 18. Gold Ask/Bid alias mapping
  {
    const m = autoMapColumns(['Date', 'Selling Price', 'Buying Price'], 'gold');
    check('Selling Price maps to ask, Buying Price to bid', m.ask != null && m.bid != null, `got ${JSON.stringify(m)}`);
  }
  // 19. FX pair direction preservation (never inverted)
  {
    const rec = buildRecord('fx', ['2024-09-01', 'EGP/USD', '48', '48.5'], { date: 0, pair: 1, bid: 2, ask: 3 }, { dateFormat: 'auto', numberFormat: 'auto', settings: {} });
    check('FX pair EGP/USD preserved (base=EGP, quote=USD, not inverted)', rec.base === 'EGP' && rec.quote === 'USD', `got ${rec.base}/${rec.quote}`);
    const v = validateImportRow('fx', rec, {});
    check('FX non-EGP quote warns', v.warnings.some(w => w.includes('not EGP')), `got ${JSON.stringify(v.warnings)}`);
  }
  // 20. CPI positive-value validation
  {
    const rec = buildRecord('cpi', ['2024-09-01', '-5'], { effectiveDate: 0, cpiValue: 1 }, { dateFormat: 'auto', numberFormat: 'auto', settings: {} });
    const v = validateImportRow('cpi', rec, {});
    check('CPI negative value rejected', v.errors.length > 0, `got ${JSON.stringify(v.errors)}`);
  }

  // ---- Universal model tests ----
  // 21. Transaction sign convention
  {
    check('Outflow sign negative', signedAmount({ amount: 1000, direction: 'outflow' }) === -1000);
    check('Inflow sign positive', signedAmount({ amount: 500, direction: 'inflow' }) === 500);
    check('Missing direction defaults outflow', signedAmount({ amount: 1000 }) === -1000);
  }
  // 22. Eligibility + direction split
  {
    const txs = [
      { id: 'a', date: '2024-01-01', amount: 100, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
      { id: 'b', date: '2024-02-01', amount: 50, direction: 'inflow', status: 'paid', transactionType: 'Rent' },
      { id: 'c', date: '2025-12-01', amount: 200, direction: 'outflow', status: 'paid', transactionType: 'Installment' },
    ];
    const elig = eligibleTransactions(txs, '2025-01-01');
    check('Eligible filters by date', elig.length === 2, `got ${elig.length}`);
    check('Outflows separated', outflows(elig).length === 1, `got ${outflows(elig).length}`);
    check('Inflows separated', inflows(elig).length === 1, `got ${inflows(elig).length}`);
  }
  // 23. MOIC + simple ROI + economic value
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate' };
    const txs = [{ id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('MOIC = 1.5', Math.abs(res.performance.moic - 1.5) < 1e-6, `got ${res.performance.moic}`);
    check('Simple ROI = 0.5', Math.abs(res.performance.simpleROI - 0.5) < 1e-6, `got ${res.performance.simpleROI}`);
    check('Net invested capital = 100000', Math.abs(res.performance.netInvestedCapital - 100000) < 1e-6, `got ${res.performance.netInvestedCapital}`);
    check('Total economic value = 150000', Math.abs(res.performance.totalEconomicValue - 150000) < 1e-6, `got ${res.performance.totalEconomicValue}`);
  }
  // 24. XIRR ~ 50% for single outflow + terminal
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate' };
    const txs = [{ id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('XIRR ~ 0.5', res.xirrVal != null && Math.abs(res.xirrVal - 0.5) < 1e-3, `got ${res.xirrVal}`);
  }
  // 25. XNPV at 10%
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate' };
    const txs = [{ id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    const expected = -100000 + 150000 / 1.1;
    check('XNPV ~ 36363.6', res.xnpvVal != null && Math.abs(res.xnpvVal - expected) < 1e-2, `got ${res.xnpvVal}`);
  }
  // 26. Real (inflation-adjusted) return
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate' };
    const txs = [{ id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const cpi = [{ effectiveDate: '2024-01-01', cpiValue: 200 }, { effectiveDate: '2025-01-01', cpiValue: 250 }];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi, customBenchmarks: [], settings: baseSettings });
    check('Real invested capital = 125000', Math.abs(res.performance.realInvestedCapital - 125000) < 1e-4, `got ${res.performance.realInvestedCapital}`);
    check('Real gain = 25000', Math.abs(res.performance.realGain - 25000) < 1e-4, `got ${res.performance.realGain}`);
    check('Real return = 0.2', Math.abs(res.performance.realReturn - 0.2) < 1e-4, `got ${res.performance.realReturn}`);
  }
  // 27. Fixed-return benchmark future value
  {
    const bench = { id: 'fixed', label: 'Fixed', type: 'fixed', subtype: 'fixed', rate: 0.12, compounding: 'annual' };
    const flows = [{ id: 'o', date: '2024-01-01', amount: 100000, status: 'paid' }];
    const r = evaluateBenchmark(bench, flows, { gold: [], fx: [], cpi: [], customBenchmarks: [] }, '2025-01-01', 'exact');
    check('Fixed return FV = 112000', Math.abs(r.value - 112000) < 1e-4, `got ${r.value}`);
  }
  // 28. Custom benchmark (market-price series)
  {
    const cb = { id: 'cb1', name: 'Index', currency: 'EGP', data: [{ date: '2024-01-01', value: 100 }, { date: '2025-01-01', value: 200 }] };
    const bench = { id: 'custom:cb1', label: 'Index', type: 'market', subtype: 'custom', benchmarkId: 'cb1', currency: 'EGP' };
    const flows = [{ id: 'o', date: '2024-01-01', amount: 100000, status: 'paid' }];
    const r = evaluateBenchmark(bench, flows, { gold: [], fx: [], cpi: [], customBenchmarks: [cb] }, '2025-01-01', 'exact');
    check('Custom benchmark invested = 100000', Math.abs(r.invested - 100000) < 1e-4, `got ${r.invested}`);
    check('Custom benchmark value = 200000', Math.abs(r.value - 200000) < 1e-4, `got ${r.value}`);
  }
  // 29. Opportunity cost = benchmark value - economic value
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate' };
    const txs = [{ id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const cb = { id: 'cb1', name: 'Index', currency: 'EGP', data: [{ date: '2024-01-01', value: 100 }, { date: '2025-01-01', value: 200 }] };
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [cb], settings: baseSettings });
    const opp = res.benchmarks['custom:cb1'].opportunityCost;
    check('Opportunity cost = 50000', Math.abs(opp - 50000) < 1e-4, `got ${opp}`);
  }
  // 30. Closed investment: terminal value forced 0, sale proceeds = economic value, basis not reduced by full sale
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 50000, status: 'Closed/Sold', type: 'real_estate' };
    const txs = [
      { id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
      { id: 's', date: '2024-06-01', amount: 180000, direction: 'inflow', status: 'paid', transactionType: 'Full Sale' },
    ];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('Closed: current value forced 0', Math.abs(res.performance.currentValue) < 1e-6, `got ${res.performance.currentValue}`);
    check('Closed: total economic value = 180000', Math.abs(res.performance.totalEconomicValue - 180000) < 1e-6, `got ${res.performance.totalEconomicValue}`);
    check('Closed: full sale does not reduce basis', Math.abs(res.performance.netInvestedCapital - 100000) < 1e-6, `got ${res.performance.netInvestedCapital}`);
    check('Closed: MOIC = 1.8', Math.abs(res.performance.moic - 1.8) < 1e-6, `got ${res.performance.moic}`);
  }
  // 31. Partial capital return reduces basis; income does not
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate' };
    const txsP = [
      { id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
      { id: 'cr', date: '2024-06-01', amount: 20000, direction: 'inflow', status: 'paid', transactionType: 'Capital Return' },
    ];
    const resP = analyzeInvestment({ investment: inv, transactions: txsP, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('Partial capital return reduces basis to 80000', Math.abs(resP.performance.netInvestedCapital - 80000) < 1e-6, `got ${resP.performance.netInvestedCapital}`);
    check('Partial: economic value = 170000', Math.abs(resP.performance.totalEconomicValue - 170000) < 1e-6, `got ${resP.performance.totalEconomicValue}`);

    const txsI = [
      { id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
      { id: 'r', date: '2024-06-01', amount: 20000, direction: 'inflow', status: 'paid', transactionType: 'Rent' },
    ];
    const resI = analyzeInvestment({ investment: inv, transactions: txsI, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('Rent income does not reduce basis', Math.abs(resI.performance.netInvestedCapital - 100000) < 1e-6, `got ${resI.performance.netInvestedCapital}`);
    check('Rent counted in inflows', Math.abs(resI.performance.totalInflows - 20000) < 1e-6, `got ${resI.performance.totalInflows}`);
  }
  // 32. Governance status rollup + date-gap classification
  {
    check('Blocking -> INVALID', rollupStatus([{ severity: 'BLOCKING' }, { severity: 'WARNING' }]) === 'INVALID');
    check('Error -> INCOMPLETE', rollupStatus([{ severity: 'ERROR' }]) === 'INCOMPLETE');
    check('Warning -> WARNING', rollupStatus([{ severity: 'WARNING' }]) === 'WARNING');
    check('No issues -> READY', rollupStatus([]) === 'READY');
    check('0 days -> Exact', dateGapStatus(0).label === 'Exact');
    check('2 days -> Good', dateGapStatus(2).label === 'Good');
    check('5 days -> Warning', dateGapStatus(5).label === 'Warning');
    check('10 days -> Strong warning', dateGapStatus(10).label === 'Strong warning');
    check('null gap -> INCOMPLETE', dateGapStatus(null).status === 'INCOMPLETE');
  }
  // 33. Benchmark registry includes gold / cpi / fixed
  {
    const reg = benchmarkRegistry(baseSettings, { customBenchmarks: [] });
    check('Registry includes gold', reg.some(b => b.id === 'gold'));
    check('Registry includes cpi', reg.some(b => b.id === 'cpi'));
    check('Registry includes fixed', reg.some(b => b.id === 'fixed'));
  }
  // 34. Legacy cashflow migration convention
  {
    const legacy = { id: 'x', investmentId: 'i1', date: '2024-01-01', amount: 100, paymentType: 'Installment', status: 'paid' };
    const migrated = { ...legacy, direction: legacy.direction || 'outflow', transactionType: legacy.transactionType || legacy.paymentType || 'Installment' };
    check('Legacy cashflow gets outflow direction', migrated.direction === 'outflow');
    check('Legacy cashflow transactionType from paymentType', migrated.transactionType === 'Installment');
  }
  // 35. Demo investment still analyzes (backward compat with existing seed)
  {
    const inv = { id: 'd1', name: 'Demo Apartment (DEMO DATA)', type: 'real_estate', status: 'Active', valuationDate: '2026-08-01', currentValuation: 1100000, baseCurrency: 'EGP' };
    const txs = [
      { id: 'cf-1', investmentId: 'd1', date: '2024-09-01', amount: 500000, direction: 'outflow', transactionType: 'Down Payment', status: 'paid' },
      { id: 'cf-2', investmentId: 'd1', date: '2025-01-15', amount: 250000, direction: 'outflow', transactionType: 'Installment', status: 'paid' },
      { id: 'cf-3', investmentId: 'd1', date: '2025-06-01', amount: 250000, direction: 'outflow', transactionType: 'Installment', status: 'paid' },
    ];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: { ...baseSettings, enabledCurrencies: [] } });
    check('Demo investment total outflows = 1,000,000', Math.abs(res.performance.totalOutflows - 1000000) < 1e-6, `got ${res.performance.totalOutflows}`);
    check('Demo investment MOIC = 1.1', Math.abs(res.performance.moic - 1.1) < 1e-6, `got ${res.performance.moic}`);
  }

  return results;
}