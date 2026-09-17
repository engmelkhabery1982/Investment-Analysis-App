import * as D from './decimal';
import { resolveDate, goldComparison, fxComparison, cpiComparison, eligibleCashFlows } from './finance';
import { parseDelimited, parseClipboard, autoMapColumns, parseDateField, parseNumber, prepareRows, buildRecord, validateImportRow } from './importEngine';

// Spec test cases. Returns array of { name, passed, detail }.
export function runTests() {
  const results = [];

  function check(name, cond, detail) {
    results.push({ name, passed: !!cond, detail: detail || '' });
  }

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
      { id: 'b', date: '2025-06-01', amount: 100, status: 'paid' }, // == valuation date
      { id: 'c', date: '2025-07-01', amount: 100, status: 'paid' }, // after
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

  return results;
}