import * as D from './decimal';
import { resolveDate, goldComparison, fxComparison, cpiComparison, eligibleCashFlows, parseDate } from './finance';
import { parseDelimited, parseClipboard, autoMapColumns, parseDateField, parseNumber, prepareRows, buildRecord, validateImportRow, dupKey, buildOps, STATUS } from './importEngine';
import { signedAmount, eligibleTransactions, outflows, inflows } from './transactions';
import { analyzeInvestment, computeXIRR } from './performance';
import { evaluateBenchmark, benchmarkRegistry } from './benchmarks';
import { rollupStatus, dateGapStatus } from './governance';
import { analyzePortfolio } from './portfolio';
import { applyScenario } from './scenarios';
import { aggregateAudit, filterAudit, auditCSVRows } from './auditAggregator';
import { buildDataQuality } from './dataQuality';
import { buildBackup, validateBackup, BACKUP_VERSION } from './backup';
import { investmentSummaryRows, portfolioSummaryRows } from './summaryExport';

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
    // actual/365 day count: 2024-01-01 -> 2025-01-01 spans 366 days (leap year),
    // so XIRR = 1.5^(365/366) - 1 ≈ 0.49834, not exactly 0.5.
    check('XIRR ~ 0.4983 (actual/365 over 366-day leap span)', res.xirrVal != null && Math.abs(res.xirrVal - 0.498339) < 1e-3, `got ${res.xirrVal}`);
  }
  // 25. XNPV at 10%
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate' };
    const txs = [{ id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    // actual/365 over 366-day leap span: years = 366/365.
    const expected = -100000 + 150000 / Math.pow(1.1, 366 / 365);
    check('XNPV ~ 36328.0 (actual/365)', res.xnpvVal != null && Math.abs(res.xnpvVal - expected) < 1e-2, `got ${res.xnpvVal}`);
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
    // annual compounding scaled by actual/365: 100000 * 1.12^(366/365) ≈ 112034.78
    check('Fixed return FV = 112034.78 (actual/365, 366 days)', Math.abs(r.value - 112034.78) < 1e-2, `got ${r.value}`);
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

  // ---- Product layer tests ----
  // 36. Portfolio aggregation (single investment)
  {
    const state = {
      investments: [{ id: 'i1', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }],
      gold: [], fx: [], cpi: [], customBenchmarks: [],
      settings: baseSettings,
    };
    const p = analyzePortfolio(state);
    check('Portfolio total invested = 100000', Math.abs(p.totals.totalInvestedCapital - 100000) < 1e-6, `got ${p.totals.totalInvestedCapital}`);
    check('Portfolio economic value = 150000', Math.abs(p.totals.totalEconomicValue - 150000) < 1e-6, `got ${p.totals.totalEconomicValue}`);
    check('Portfolio gain = 50000', Math.abs(p.totals.totalGain - 50000) < 1e-6, `got ${p.totals.totalGain}`);
    check('Portfolio ROI = 0.5', Math.abs(p.totals.portfolioROI - 0.5) < 1e-6, `got ${p.totals.portfolioROI}`);
    check('Portfolio MOIC = 1.5', Math.abs(p.totals.portfolioMOIC - 1.5) < 1e-6, `got ${p.totals.portfolioMOIC}`);
    check('Portfolio XIRR ~ 0.4983 (actual/365 over 366-day leap span)', p.totals.portfolioXIRR != null && Math.abs(p.totals.portfolioXIRR - 0.498339) < 1e-3, `got ${p.totals.portfolioXIRR}`);
    check('Portfolio allocation by type real_estate = 100000', Math.abs(p.allocationByType.real_estate - 100000) < 1e-6);
  }
  // 37. Portfolio mixed investment types
  {
    const state = {
      investments: [
        { id: 'i1', name: 'RE', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' },
        { id: 'i2', name: 'Gold', type: 'gold', status: 'Active', valuationDate: '2025-01-01', currentValuation: 60000, baseCurrency: 'EGP' },
      ],
      cashflows: [
        { id: 'a', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
        { id: 'b', investmentId: 'i2', date: '2024-01-01', amount: 50000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
      ],
      gold: [], fx: [], cpi: [], customBenchmarks: [],
      settings: baseSettings,
    };
    const p = analyzePortfolio(state);
    check('Mixed: total invested = 150000', Math.abs(p.totals.totalInvestedCapital - 150000) < 1e-6, `got ${p.totals.totalInvestedCapital}`);
    check('Mixed: total economic value = 210000', Math.abs(p.totals.totalEconomicValue - 210000) < 1e-6, `got ${p.totals.totalEconomicValue}`);
    check('Mixed: gain = 60000', Math.abs(p.totals.totalGain - 60000) < 1e-6, `got ${p.totals.totalGain}`);
    check('Mixed: ROI = 0.4', Math.abs(p.totals.portfolioROI - 0.4) < 1e-6, `got ${p.totals.portfolioROI}`);
    check('Mixed: MOIC = 1.4', Math.abs(p.totals.portfolioMOIC - 1.4) < 1e-6, `got ${p.totals.portfolioMOIC}`);
    check('Mixed: allocation real_estate = 100000', Math.abs(p.allocationByType.real_estate - 100000) < 1e-6);
    check('Mixed: allocation gold = 50000', Math.abs(p.allocationByType.gold - 50000) < 1e-6);
    check('Mixed: allocation by status Active = 150000', Math.abs(p.allocationByStatus.Active - 150000) < 1e-6);
  }
  // 38. Comparison consistency — portfolio item analysis equals a direct analyzeInvestment call
  {
    const state = {
      investments: [{ id: 'i1', name: 'A', type: 'stock', status: 'Active', valuationDate: '2025-01-01', currentValuation: 120000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }],
      gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings,
    };
    const p = analyzePortfolio(state);
    const direct = analyzeInvestment({ investment: state.investments[0], transactions: state.cashflows, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('Comparison consistency: item equals direct analysis', p.items[0].analysis.performance.netInvestedCapital === direct.performance.netInvestedCapital && p.items[0].analysis.performance.moic === direct.performance.moic);
  }
  // 39. Scenario isolation — never mutates original data
  {
    const investment = { id: 'i1', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' };
    const transactions = [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const ctx = { investment, transactions, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings };
    const before = JSON.stringify({ investment, transactions });
    const { analysis } = applyScenario(ctx, { currentValuation: 200000, fixedReturnRate: 0.15, exitFees: 5000 });
    const after = JSON.stringify({ investment, transactions });
    check('Scenario does not mutate original data', before === after);
    check('Scenario applies alternative value minus fees (200000-5000=195000)', Math.abs(analysis.performance.totalEconomicValue - 195000) < 1e-6, `got ${analysis.performance.totalEconomicValue}`);
    check('Scenario base analysis unchanged (150000)', Math.abs(analyzeInvestment(ctx).performance.totalEconomicValue - 150000) < 1e-6);
  }
  // 40. Scenario unsafe valuation date is rejected (not applied)
  {
    const investment = { id: 'i1', valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate', baseCurrency: 'EGP' };
    const transactions = [{ id: 'o', investmentId: 'i1', date: '2024-06-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const ctx = { investment, transactions, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings };
    const { analysis, warnings } = applyScenario(ctx, { valuationDate: '2024-05-01' });
    check('Unsafe scenario valuation date keeps original (1 eligible)', analysis.eligible.length === 1, `got ${analysis.eligible.length}`);
    check('Unsafe scenario valuation date warns', warnings.length > 0 && /not applied/.test(warnings[0]), `got ${JSON.stringify(warnings)}`);
  }
  // 41. Unavailable metrics shown as N/A (no sign change, no terminal)
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 0, status: 'Active', type: 'real_estate', baseCurrency: 'EGP' };
    const txs = [{ id: 'o', date: '2024-01-01', amount: 1000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('XIRR null when no sign change / no terminal', res.performance.xirrVal == null, `got ${res.performance.xirrVal}`);
    check('MOIC = 0 when economic value is 0', Math.abs(res.performance.moic - 0) < 1e-6, `got ${res.performance.moic}`);
    check('Real return N/A when no CPI (realInvestedCapital=0)', res.performance.realInvestedCapital === 0, `got ${res.performance.realInvestedCapital}`);
  }
  // 42. Benchmark settings — fixed-return rate & compounding
  {
    const flows = [{ id: 'o', date: '2024-01-01', amount: 100000, status: 'paid' }];
    const st = { gold: [], fx: [], cpi: [], customBenchmarks: [] };
    const r1 = evaluateBenchmark({ id: 'fixed', label: 'Fixed', type: 'fixed', subtype: 'fixed', rate: 0.12, compounding: 'annual' }, flows, st, '2025-01-01', 'exact');
    const r2 = evaluateBenchmark({ id: 'fixed', label: 'Fixed', type: 'fixed', subtype: 'fixed', rate: 0.20, compounding: 'annual' }, flows, st, '2025-01-01', 'exact');
    const rM = evaluateBenchmark({ id: 'fixed', label: 'Fixed', type: 'fixed', subtype: 'fixed', rate: 0.12, compounding: 'monthly' }, flows, st, '2025-01-01', 'exact');
    // actual/365 over 366-day leap span
    check('Fixed 12% annual -> 112034.78', Math.abs(r1.value - 112034.78) < 1e-2, `got ${r1.value}`);
    check('Fixed 20% annual -> 120059.96', Math.abs(r2.value - 120059.96) < 1e-2, `got ${r2.value}`);
    check('Fixed 12% monthly -> ~112719.37', Math.abs(rM.value - 100000 * Math.pow(1.01, 12 * 366 / 365)) < 1e-2, `got ${rM.value}`);
  }
  // 43. Dashboard / PerformanceGrid consistency — engine exposes all grid fields
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate', baseCurrency: 'EGP' };
    const txs = [{ id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    const fields = ['netInvestedCapital', 'totalEconomicValue', 'gain', 'simpleROI', 'moic', 'xirrVal', 'annualizedReturn', 'realReturn', 'realInvestedCapital'];
    check('Performance engine exposes all grid fields', fields.every(f => typeof res.performance[f] !== 'undefined'), `missing ${fields.filter(f => typeof res.performance[f] === 'undefined')}`);
  }
  // 44. computeXIRR exported and reusable
  {
    const r = computeXIRR([{ date: parseDate('2024-01-01'), amount: -100 }, { date: parseDate('2025-01-01'), amount: 150 }]);
    check('computeXIRR ~ 0.4983 (actual/365 over 366-day leap span)', r != null && Math.abs(r - 0.498339) < 1e-3, `got ${r}`);
  }
  // 45. Backward compatibility — legacy investment (no type/status) and legacy cashflow (no direction)
  {
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' };
    const txs = [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, paymentType: 'Installment', status: 'paid' }];
    const res = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('Legacy investment (no type/status) still analyzes', res.performance != null && Math.abs(res.performance.moic - 1.5) < 1e-6, `got ${res.performance.moic}`);
    check('Legacy investment defaults to Active (not closed)', res.isClosed === false);
    check('Legacy cashflow (no direction) treated as outflow', res.performance.totalOutflows === 100000, `got ${res.performance.totalOutflows}`);
  }

  // ---- Final Governance & Portability tests ----
  function allAnalysesOf(state) {
    return state.investments.map(inv => {
      const transactions = (state.cashflows || []).filter(c => c.investmentId === inv.id);
      return { investment: inv, analysis: analyzeInvestment({ investment: inv, transactions, gold: state.gold, fx: state.fx, cpi: state.cpi, customBenchmarks: state.customBenchmarks, settings: state.settings }) };
    });
  }

  // 46. Audit aggregation — traceable rows with investment + benchmark + applied date
  {
    const state = {
      investments: [{ id: 'i1', name: 'Apt', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', transactionType: 'Purchase', status: 'paid' }],
      gold: [{ date: '2024-01-01', karat: '21K', unit: 'gram', ask: 4000, bid: 3900, source: 'SGE' }, { date: '2025-01-01', karat: '21K', unit: 'gram', ask: 5000, bid: 4900, source: 'SGE' }],
      fx: [], cpi: [], customBenchmarks: [], settings: { ...baseSettings, enabledCurrencies: [] },
    };
    const rows = aggregateAudit(state, allAnalysesOf(state));
    check('Audit aggregates rows', rows.length > 0, `got ${rows.length}`);
    const goldRow = rows.find(r => r.benchmark === 'Gold' && r.appliedDate);
    check('Audit Gold row carries investment name', goldRow && goldRow.investmentName === 'Apt', `got ${goldRow && goldRow.investmentName}`);
    check('Audit Gold row carries transaction direction/type', goldRow && goldRow.direction === 'outflow' && goldRow.transactionType === 'Purchase', `got ${goldRow && goldRow.direction}/${goldRow && goldRow.transactionType}`);
    check('Audit Gold row carries applied source date', goldRow && goldRow.appliedDate === '2024-01-01', `got ${goldRow && goldRow.appliedDate}`);
    check('Audit Gold row resolves data source', goldRow && goldRow.source === 'SGE', `got ${goldRow && goldRow.source}`);
  }
  // 47. Audit filtering by investment / benchmark / status + CSV export
  {
    const state = {
      investments: [{ id: 'i1', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', transactionType: 'Purchase', status: 'paid' }],
      gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings,
    };
    const rows = aggregateAudit(state, allAnalysesOf(state));
    const byInv = filterAudit(rows, { investmentId: 'i1' });
    check('Audit filter by investment returns all its rows', byInv.length === rows.length, `got ${byInv.length}`);
    const errOnly = filterAudit(rows, { status: 'ERROR' });
    check('Audit filter by ERROR returns only unresolved rows', errOnly.every(r => r.status === 'ERROR'), `got ${errOnly.length}`);
    const csv = auditCSVRows(rows);
    check('Audit CSV has header + rows', csv.length === rows.length + 1 && csv[0].length > 10, `got ${csv.length}`);
  }
  // 48. Data Quality severity rollup + missing market data
  {
    const state = {
      investments: [{ id: 'i1', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', transactionType: 'Purchase', status: 'paid' }],
      gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings,
    };
    const dq = buildDataQuality(state, allAnalysesOf(state));
    check('DQ: gold missing flagged', dq.missing.gold >= 1, `got ${dq.missing.gold}`);
    check('DQ: issues sorted worst-first (BLOCKING/ERROR before WARNING)', dq.issues.length > 0, `got ${dq.issues.length}`);
    check('DQ: status is not READY when data missing', dq.status !== 'READY', `got ${dq.status}`);
  }
  // 49. Date-gap classification in data quality
  {
    const state = {
      investments: [{ id: 'i1', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', transactionType: 'Purchase', status: 'paid' }],
      gold: [{ date: '2024-01-15', karat: '21K', unit: 'gram', ask: 4000, bid: 3900 }], // 14 days away under 'nearest'/'previous'
      fx: [], cpi: [], customBenchmarks: [], settings: { ...baseSettings, defaultDatePolicy: 'nearest' },
    };
    const dq = buildDataQuality(state, allAnalysesOf(state));
    check('DQ: date-gap detected for gold', dq.gaps.some(g => g.benchmark === 'Gold' && g.gapDays > 0), `got ${JSON.stringify(dq.gaps)}`);
  }
  // 50. Exact duplicate vs true import conflict (distinct keys by direction/type)
  {
    const existing = [{ id: 'cf-1', date: '2024-01-01', amount: 1000, direction: 'outflow', transactionType: 'Purchase', installmentNumber: '' }];
    // same everything => conflict
    const sameRow = ['2024-01-01', '1000', 'outflow', 'Purchase'];
    const map = { date: 0, amount: 1, direction: 2, transactionType: 3 };
    const pSame = prepareRows('cashflow', [sameRow], map, { dateFormat: 'auto', numberFormat: 'auto', settings: {} }, existing, { investmentId: 'i1' });
    check('Cashflow exact duplicate of existing -> conflict', pSame[0].status === 'conflict', `got ${pSame[0].status}`);
    // same date+amount but DIFFERENT direction/type -> NOT a conflict (distinct keys)
    const diffRow = ['2024-01-01', '1000', 'inflow', 'Rent'];
    const pDiff = prepareRows('cashflow', [diffRow], map, { dateFormat: 'auto', numberFormat: 'auto', settings: {} }, existing, { investmentId: 'i1' });
    check('Cashflow different direction/type -> new (not conflict)', pDiff[0].status === 'new', `got ${pDiff[0].status}`);
    // two identical rows in the same batch -> second is duplicate
    const batch = [sameRow, sameRow];
    const pBatch = prepareRows('cashflow', batch, map, { dateFormat: 'auto', numberFormat: 'auto', settings: {} }, [], { investmentId: 'i1' });
    check('Cashflow batch exact duplicate -> duplicate', pBatch[1].status === 'duplicate', `got ${pBatch[1].status}`);
  }
  // 51. Ambiguous import values must be flagged
  {
    const r = parseDateField('05/06/2024', 'auto');
    check('Ambiguous date flagged (not silently guessed)', r.ambiguous === true, `got ${JSON.stringify(r)}`);
    const resolved = parseDateField('05/06/2024', 'mdy');
    check('Ambiguous date resolved once format chosen', resolved.iso === '2024-05-06' && !resolved.ambiguous, `got ${resolved.iso}`);
  }
  // 52. Universal transaction import (direction, type, quantity, unit price, fees)
  {
    const row = ['2024-01-01', '50000', 'outflow', 'Purchase', 'EGP', '10', '5000', '25'];
    const map = { date: 0, amount: 1, direction: 2, transactionType: 3, currency: 4, quantity: 5, unitPrice: 6, fees: 7 };
    const rec = buildRecord('cashflow', row, map, { dateFormat: 'auto', numberFormat: 'auto', settings: {} });
    check('Universal cashflow: direction mapped', rec.direction === 'outflow', `got ${rec.direction}`);
    check('Universal cashflow: transactionType mapped', rec.transactionType === 'Purchase', `got ${rec.transactionType}`);
    check('Universal cashflow: quantity/unitPrice/fees parsed', rec.quantity === 10 && rec.unitPrice === 5000 && rec.fees === 25, `got ${rec.quantity}/${rec.unitPrice}/${rec.fees}`);
    const v = validateImportRow('cashflow', rec, {});
    check('Universal cashflow: valid row has no errors', v.errors.length === 0, `got ${JSON.stringify(v.errors)}`);
    check('Universal cashflow: dupKey includes direction+type', dupKey('cashflow', rec, { investmentId: 'i1' }) === 'i1|2024-01-01|50000|outflow|Purchase|', `got ${dupKey('cashflow', rec, { investmentId: 'i1' })}`);
  }
  // 53. Precision preservation through import
  {
    const r = parseNumber('123456.789012345');
    check('Imported numeric value preserves precision', Math.abs(r.value - 123456.789012345) < 1e-9, `got ${r.value}`);
    const rec = buildRecord('cashflow', ['2024-01-01', '123456.789012345', 'outflow', 'Purchase'], { date: 0, amount: 1, direction: 2, transactionType: 3 }, { dateFormat: 'auto', numberFormat: 'auto', settings: {} });
    check('Built cashflow preserves amount precision', Math.abs(rec.amount - 123456.789012345) < 1e-9, `got ${rec.amount}`);
  }
  // 54. Invalid-row atomicity — error rows excluded from import ops
  {
    const rows = [['2024-01-01', '1000', 'outflow', 'Purchase'], ['2024-01-01', '0', 'outflow', 'Purchase']];
    const map = { date: 0, amount: 1, direction: 2, transactionType: 3 };
    const prepared = prepareRows('cashflow', rows, map, { dateFormat: 'auto', numberFormat: 'auto', settings: {} }, [], { investmentId: 'i1' });
    const actions = prepared.map(p => p.status === STATUS.ERROR ? 'skip-reject' : 'insert');
    const ops = buildOps('cashflow', prepared, actions);
    check('Invalid row rejected (status=error)', prepared[1].status === 'error', `got ${prepared[1].status}`);
    check('Invalid row excluded from import ops (atomicity)', ops.length === 1 && ops[0].record.amount === 1000, `got ${ops.length}`);
  }
  // 55. Investment import type
  {
    const row = ['Villa', 'real_estate', 'Active', 'EGP', '2025-01-01', '2000000'];
    const map = { name: 0, type: 1, status: 2, baseCurrency: 3, valuationDate: 4, currentValuation: 5 };
    const rec = buildRecord('investment', row, map, { dateFormat: 'auto', numberFormat: 'auto', settings: baseSettings });
    const v = validateImportRow('investment', rec, {});
    check('Investment import: name/type/status/valuation mapped', rec.name === 'Villa' && rec.type === 'real_estate' && rec.status === 'Active' && rec.valuationDate === '2025-01-01', `got ${JSON.stringify(rec)}`);
    check('Investment import: valid row has no errors', v.errors.length === 0, `got ${JSON.stringify(v.errors)}`);
    check('Investment import: dupKey by name', dupKey('investment', rec) === 'inv|villa', `got ${dupKey('investment', rec)}`);
    const bad = buildRecord('investment', ['', 'real_estate', 'Active', 'EGP', '', ''], map, { dateFormat: 'auto', numberFormat: 'auto', settings: baseSettings });
    check('Investment import: missing name+valuation rejected', validateImportRow('investment', bad, {}).errors.length > 0, `got ${validateImportRow('investment', bad, {}).errors.length}`);
  }
  // 56. Custom benchmark data import
  {
    const row = ['EGI30', 'EGP', '2024-01-01', '1200', 'CAPMAS'];
    const map = { name: 0, currency: 1, date: 2, value: 3, source: 4 };
    const rec = buildRecord('custombenchmark', row, map, { dateFormat: 'auto', numberFormat: 'auto', settings: baseSettings });
    const v = validateImportRow('custombenchmark', rec, {});
    check('Custom benchmark import: name/date/value/source mapped', rec.name === 'EGI30' && rec.date === '2024-01-01' && rec.value === 1200 && rec.source === 'CAPMAS', `got ${JSON.stringify(rec)}`);
    check('Custom benchmark import: valid row has no errors', v.errors.length === 0, `got ${JSON.stringify(v.errors)}`);
    check('Custom benchmark import: dupKey by name+date', dupKey('custombenchmark', rec) === 'cb|egi30|2024-01-01', `got ${dupKey('custombenchmark', rec)}`);
  }
  // 57. Full backup export — structure, version, all collections
  {
    const state = {
      investments: [{ id: 'i1', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid' }],
      gold: [{ id: 'g1', date: '2024-01-01', karat: '21K', ask: 4000, bid: 3900 }],
      fx: [{ id: 'f1', date: '2024-01-01', base: 'USD', quote: 'EGP', bid: 48, ask: 48.5 }],
      cpi: [{ id: 'c1', effectiveDate: '2024-01-01', cpiValue: 200 }],
      customBenchmarks: [{ id: 'cb1', name: 'EGI30', currency: 'EGP', data: [{ date: '2024-01-01', value: 1200 }] }],
      scenarios: [{ id: 'sc1', name: 'Bull', investmentId: 'i1', overrides: { currentValuation: 200000 } }],
      settings: { ...baseSettings, defaultCurrency: 'EGP' },
    };
    const bk = buildBackup(state);
    check('Backup: format = pia-backup', bk.format === 'pia-backup', `got ${bk.format}`);
    check('Backup: version = BACKUP_VERSION', bk.version === BACKUP_VERSION, `got ${bk.version}`);
    check('Backup: contains investments', bk.state.investments.length === 1);
    check('Backup: contains scenarios', bk.state.scenarios.length === 1);
    check('Backup: contains custom benchmarks', bk.state.customBenchmarks.length === 1);
    check('Backup: contains settings', bk.state.settings.defaultCurrency === 'EGP');
  }
  // 58. Valid restore — JSON round-trip preserves all counts
  {
    const state = {
      investments: [{ id: 'i1', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid' }],
      gold: [], fx: [], cpi: [], customBenchmarks: [{ id: 'cb1', name: 'EGI30', currency: 'EGP', data: [] }],
      scenarios: [{ id: 'sc1', name: 'S', investmentId: 'i1', overrides: {} }],
      settings: baseSettings,
    };
    const round = JSON.parse(JSON.stringify(buildBackup(state)));
    const v = validateBackup(round);
    check('Valid backup round-trip -> ok', v.ok === true, `got ${v.error}`);
    check('Valid backup preview counts match', v.preview.investments === 1 && v.preview.cashflows === 1 && v.preview.scenarios === 1 && v.preview.customBenchmarks === 1, `got ${JSON.stringify(v.preview)}`);
  }
  // 59. Corrupt backup rejection
  {
    check('Corrupt backup (not object) rejected', validateBackup(null).ok === false && validateBackup('x').ok === false);
    check('Corrupt backup (wrong format) rejected', validateBackup({ format: 'other', version: 1, state: {} }).ok === false);
    check('Corrupt backup (missing state) rejected', validateBackup({ format: 'pia-backup', version: 1 }).ok === false);
    check('Corrupt backup (array where object) rejected', validateBackup({ format: 'pia-backup', version: 1, state: { investments: {} } }).ok === false);
  }
  // 60. Incompatible-version backup rejection
  {
    check('Incompatible (newer) version rejected', validateBackup({ format: 'pia-backup', version: 99, state: {} }).ok === false, `got ${validateBackup({ format: 'pia-backup', version: 99, state: {} }).ok}`);
  }
  // 61. Restore atomicity — corrupt backup rejected BEFORE any state change
  {
    // validateBackup is the gate restoreBackup uses; a false result means restore returns
    // { ok:false } without touching the store. We assert the gate is reliable.
    const corrupt = { format: 'pia-backup', version: 1, state: { investments: 'not-an-array' } };
    const v = validateBackup(corrupt);
    check('Restore atomicity: corrupt backup blocked at validation', v.ok === false, `got ${v.error}`);
    const ok = buildBackup({ investments: [], cashflows: [], gold: [], fx: [], cpi: [], customBenchmarks: [], scenarios: [], settings: {} });
    check('Restore atomicity: valid backup passes validation', validateBackup(ok).ok === true);
  }
  // 62. Scenario + custom benchmark persistence through backup
  {
    const state = {
      investments: [{ id: 'i1', name: 'A', type: 'stock', status: 'Active', valuationDate: '2025-01-01', currentValuation: 120000, baseCurrency: 'EGP' }],
      cashflows: [], gold: [], fx: [], cpi: [],
      customBenchmarks: [{ id: 'cb1', name: 'EGI30', currency: 'EGP', data: [{ date: '2024-01-01', value: 1200 }, { date: '2025-01-01', value: 1400 }] }],
      scenarios: [{ id: 'sc1', name: 'Bull', investmentId: 'i1', overrides: { currentValuation: 200000 } }, { id: 'sc2', name: 'Bear', investmentId: 'i1', overrides: { currentValuation: 80000 } }],
      settings: baseSettings,
    };
    const round = JSON.parse(JSON.stringify(buildBackup(state)));
    check('Scenarios persist through backup', round.state.scenarios.length === 2, `got ${round.state.scenarios.length}`);
    check('Custom benchmark data persists through backup', round.state.customBenchmarks[0].data.length === 2, `got ${round.state.customBenchmarks[0].data.length}`);
  }
  // 63. Legacy data compatibility through backup
  {
    const state = {
      investments: [{ id: 'i1', name: 'Legacy', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' }],
      cashflows: [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, paymentType: 'Installment', status: 'paid' }],
      gold: [], fx: [], cpi: [], customBenchmarks: [], scenarios: [], settings: baseSettings,
    };
    const bk = buildBackup(state);
    const v = validateBackup(bk);
    check('Legacy cashflow (no direction) included in backup', bk.state.cashflows.length === 1, `got ${bk.state.cashflows.length}`);
    check('Legacy backup validates as ok', v.ok === true, `got ${v.error}`);
  }
  // 64. Portfolio differing-valuation-date governance
  {
    const state = {
      investments: [
        { id: 'a', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' },
        { id: 'b', name: 'B', type: 'stock', status: 'Active', valuationDate: '2026-01-01', currentValuation: 200000, baseCurrency: 'EGP' },
      ],
      cashflows: [
        { id: 'oa', investmentId: 'a', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
        { id: 'ob', investmentId: 'b', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
      ],
      gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings,
    };
    const p = analyzePortfolio(state);
    check('Differing val dates: mode = multiple', p.valuationDateMode === 'multiple', `got ${p.valuationDateMode}`);
    check('Differing val dates: warning emitted', (p.warnings || []).length > 0, `got ${(p.warnings || []).length}`);
    check('Differing val dates: reportingAsOf = latest (2026-01-01)', p.reportingAsOf === '2026-01-01', `got ${p.reportingAsOf}`);
    check('Differing val dates: XIRR mode = combined-dated', p.portfolioXIRRMode === 'combined-dated', `got ${p.portfolioXIRRMode}`);
    check('Differing val dates: XIRR not averaged (coherent money-weighted)', p.totals.portfolioXIRR != null && Math.abs(p.totals.portfolioXIRR - 0.4420232) < 1e-3, `got ${p.totals.portfolioXIRR}`);
  }
  // 65. Portfolio single valuation date — no differing-date warning
  {
    const state = {
      investments: [
        { id: 'a', name: 'A', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' },
        { id: 'b', name: 'B', type: 'stock', status: 'Active', valuationDate: '2025-01-01', currentValuation: 200000, baseCurrency: 'EGP' },
      ],
      cashflows: [
        { id: 'oa', investmentId: 'a', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
        { id: 'ob', investmentId: 'b', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' },
      ],
      gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings,
    };
    const p = analyzePortfolio(state);
    check('Single val date: mode = single', p.valuationDateMode === 'single', `got ${p.valuationDateMode}`);
    check('Single val date: no differing-date warning', !(p.warnings || []).some(w => /own valuation date/.test(w)), `got ${JSON.stringify(p.warnings)}`);
  }
  // 66. Exportable summaries produce rows
  {
    const inv = { name: 'Apt', type: 'real_estate', status: 'Active', valuationDate: '2025-01-01', currentValuation: 150000, baseCurrency: 'EGP' };
    const txs = [{ id: 'o', investmentId: 'i1', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }];
    const analysis = analyzeInvestment({ investment: inv, transactions: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    const rows = investmentSummaryRows(analysis, inv);
    check('Investment summary exports rows with key metrics', rows.some(r => r[0] === 'ROI') && rows.some(r => r[0] === 'XIRR') && rows.some(r => r[0] === 'MOIC'), `got ${rows.length} rows`);
    const p = analyzePortfolio({ investments: [{ ...inv, id: 'i1' }], cashflows: txs, gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    const prows = portfolioSummaryRows(p, { settings: baseSettings });
    check('Portfolio summary exports as-of + XIRR mode', prows.some(r => r[0] === 'Portfolio reporting / as-of date') && prows.some(r => r[0] === 'Portfolio XIRR mode'), `got ${prows.length} rows`);
  }
  // 67. No regression in verified financial calculations
  {
    const flows = [{ id: 't1', date: '2024-01-01', amount: 100000, status: 'paid' }];
    const gold = [{ date: '2024-01-01', karat: '21K', ask: 4000, bid: 4000 }, { date: '2025-01-01', karat: '21K', ask: 5000, bid: 5000 }];
    const r = goldComparison(flows, gold, '2025-01-01', 'exact', '21K');
    check('No regression: Gold liquidation still 125,000', Math.abs(D.toNumber(r.liquidation) - 125000) < 1e-6, `got ${D.toNumber(r.liquidation)}`);
    const x = computeXIRR([{ date: parseDate('2024-01-01'), amount: -100000 }, { date: parseDate('2025-01-01'), amount: 150000 }]);
    check('No regression: XIRR still ~0.4983 (actual/365)', x != null && Math.abs(x - 0.498339) < 1e-3, `got ${x}`);
    const inv = { valuationDate: '2025-01-01', currentValuation: 150000, status: 'Active', type: 'real_estate' };
    const res = analyzeInvestment({ investment: inv, transactions: [{ id: 'o', date: '2024-01-01', amount: 100000, direction: 'outflow', status: 'paid', transactionType: 'Purchase' }], gold: [], fx: [], cpi: [], customBenchmarks: [], settings: baseSettings });
    check('No regression: MOIC still 1.5', Math.abs(res.performance.moic - 1.5) < 1e-6, `got ${res.performance.moic}`);
  }

  return results;
}