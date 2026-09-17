import * as D from './decimal';
import { resolveDate, goldComparison, fxComparison, cpiComparison, eligibleCashFlows } from './finance';

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

  return results;
}