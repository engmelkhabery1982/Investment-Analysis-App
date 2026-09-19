import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndexedDbRepository, V2_SCHEMA_VERSION } from '../src/repository/indexedDbRepository.js';
import { buildBackup, validateBackup } from '../src/lib/backup.js';

let sequence = 0;
const dbName = () => `investcompare-v2-test-${Date.now()}-${sequence++}`;

function sampleState() {
  return {
    investments: [{ id: 'inv1', name: 'Property', type: 'real_estate', status: 'Active', baseCurrency: 'EGP', valuationDate: '2026-09-19', currentValuation: 150000, extraField: 'keep-me' }],
    cashflows: [{ id: 'cf1', investmentId: 'inv1', date: '2024-09-01', amount: 105000, currency: 'EGP', direction: 'outflow', transactionType: 'Purchase', quantity: 21.875, unitPrice: 4800, fees: 7.89, extraFlow: 'keep-me' }],
    gold: [{ id: 'g1', date: '2024-09-01', karat: '21K', unit: 'gram', ask: 4800, bid: 4700, source: 'manual' }],
    fx: [{ id: 'fx1', date: '2024-09-01', base: 'USD', quote: 'EGP', ask: 48.5, bid: 48, source: 'manual' }],
    cpi: [{ id: 'cpi1', effectiveDate: '2024-09-01', cpiValue: 200, country: 'Egypt', source: 'manual' }],
    customBenchmarks: [{ id: 'cb1', name: 'Index', currency: 'EGP', data: [{ date: '2024-09-01', value: 987.6543 }] }],
    scenarios: [{ id: 'sc1', investmentId: 'inv1', name: 'Upside', arbitrary: { nested: true } }],
    settings: { defaultCurrency: 'EGP', selectedInvestmentId: 'inv1', customSetting: 'keep-me' },
  };
}

const storage = value => ({ getItem: key => key === 'pia.state.v1' ? value : null });

async function withRepo(run) {
  const repo = createIndexedDbRepository({ dbName: dbName() });
  await repo.init();
  try { await run(repo); } finally { await repo.close(); }
}

test('01 first-run migration imports pia.state.v1 and preserves source', async () => {
  await withRepo(async repo => {
    const state = sampleState();
    const raw = JSON.stringify(state);
    const source = storage(raw);
    const result = await repo.migrateFromV1LocalStorage(source, sampleState());
    assert.equal(result.migrated, true);
    assert.equal(result.reason, 'migrated');
    assert.deepEqual(await repo.loadState(), state);
    assert.equal(source.getItem('pia.state.v1'), raw);
  });
});

test('02 migration marker makes second startup idempotent', async () => {
  await withRepo(async repo => {
    const source = storage(JSON.stringify(sampleState()));
    await repo.migrateFromV1LocalStorage(source, sampleState());
    const second = await repo.migrateFromV1LocalStorage(source, sampleState());
    assert.equal(second.reason, 'already-migrated');
    assert.equal((await repo.listInvestments()).length, 1);
  });
});

test('03 state survives repository close and reopen', async () => {
  const name = dbName();
  const first = createIndexedDbRepository({ dbName: name });
  await first.init();
  await first.replaceState(sampleState());
  await first.close();
  const second = createIndexedDbRepository({ dbName: name });
  await second.init();
  assert.deepEqual(await second.loadState(), sampleState());
  assert.equal(await second.getSchemaVersion(), V2_SCHEMA_VERSION);
  await second.close();
});

test('04 investment CRUD persists updates and deletes', async () => {
  await withRepo(async repo => {
    await repo.putInvestment({ id: 'i1', name: 'A' });
    await repo.putInvestment({ id: 'i1', name: 'B', extra: 7 });
    assert.deepEqual(await repo.listInvestments(), [{ id: 'i1', name: 'B', extra: 7 }]);
    await repo.deleteInvestment('i1');
    assert.equal((await repo.listInvestments()).length, 0);
  });
});

test('05 investment delete cascades owned cashflows and selected setting', async () => {
  await withRepo(async repo => {
    await repo.replaceState(sampleState());
    await repo.deleteInvestment('inv1');
    assert.equal((await repo.listCashflows()).length, 0);
    assert.equal((await repo.getSettings()).selectedInvestmentId, null);
  });
});

test('06 cashflow CRUD preserves ownership', async () => {
  await withRepo(async repo => {
    await repo.putCashflow({ id: 'c1', investmentId: 'i1', date: '2024-01-01', amount: 1 });
    await repo.putCashflow({ id: 'c1', investmentId: 'i1', date: '2024-01-01', amount: 2 });
    assert.equal((await repo.listCashflows('i1'))[0].amount, 2);
    assert.equal((await repo.listCashflows('other')).length, 0);
    await repo.deleteCashflow('c1');
    assert.equal((await repo.listCashflows()).length, 0);
  });
});

test('07 Gold CRUD', async () => {
  await withRepo(async repo => {
    await repo.putGold({ id: 'g', date: '2024-01-01', ask: 2, bid: 1 });
    assert.equal((await repo.listGold())[0].ask, 2);
    await repo.deleteGold('g');
    assert.equal((await repo.listGold()).length, 0);
  });
});

test('08 FX CRUD', async () => {
  await withRepo(async repo => {
    await repo.putFx({ id: 'f', date: '2024-01-01', base: 'USD', quote: 'EGP', ask: 2, bid: 1 });
    assert.equal((await repo.listFx())[0].base, 'USD');
    await repo.deleteFx('f');
    assert.equal((await repo.listFx()).length, 0);
  });
});

test('09 CPI CRUD', async () => {
  await withRepo(async repo => {
    await repo.putCpi({ id: 'c', effectiveDate: '2024-01-01', cpiValue: 100 });
    assert.equal((await repo.listCpi())[0].cpiValue, 100);
    await repo.deleteCpi('c');
    assert.equal((await repo.listCpi()).length, 0);
  });
});

test('10 custom benchmark CRUD', async () => {
  await withRepo(async repo => {
    await repo.putCustomBenchmark({ id: 'b', name: 'Index', data: [] });
    assert.equal((await repo.listCustomBenchmarks())[0].name, 'Index');
    await repo.deleteCustomBenchmark('b');
    assert.equal((await repo.listCustomBenchmarks()).length, 0);
  });
});

test('11 scenario CRUD', async () => {
  await withRepo(async repo => {
    await repo.putScenario({ id: 's', name: 'Upside' });
    assert.equal((await repo.listScenarios())[0].name, 'Upside');
    await repo.deleteScenario('s');
    assert.equal((await repo.listScenarios()).length, 0);
  });
});

test('12 settings persist', async () => {
  await withRepo(async repo => {
    await repo.putSettings({ defaultCurrency: 'EGP', selectedInvestmentId: 'i1', unknown: true });
    assert.deepEqual(await repo.getSettings(), { defaultCurrency: 'EGP', selectedInvestmentId: 'i1', unknown: true });
  });
});

test('13 import insert generates compatible id when caller omits it', async () => {
  await withRepo(async repo => {
    const result = await repo.importRecords({ cashflows: [{ action: 'insert', record: { investmentId: 'i1', date: '2024-01-01', amount: 100 } }] });
    const row = (await repo.listCashflows())[0];
    assert.equal(result.inserted, 1);
    assert.match(row.id, /^cf-/);
  });
});

test('14 import replace preserves existing id', async () => {
  await withRepo(async repo => {
    await repo.putGold({ id: 'g-old', date: '2024-01-01', ask: 2, bid: 1 });
    const result = await repo.importRecords({ gold: [{ action: 'replace', existingId: 'g-old', record: { date: '2024-01-01', ask: 3, bid: 2 } }] });
    assert.equal(result.replaced, 1);
    assert.deepEqual((await repo.listGold()).map(row => row.id), ['g-old']);
  });
});

test('15 import skip leaves state unchanged', async () => {
  await withRepo(async repo => {
    await repo.putCpi({ id: 'keep', effectiveDate: '2024-01-01', cpiValue: 100 });
    const result = await repo.importRecords({ cpi: [{ action: 'skip', record: { effectiveDate: '2024-02-01', cpiValue: 200 } }] });
    assert.equal(result.skipped, 1);
    assert.deepEqual((await repo.listCpi()).map(row => row.id), ['keep']);
  });
});

test('16 invalid import plan is atomic', async () => {
  await withRepo(async repo => {
    await repo.putGold({ id: 'keep', date: '2024-01-01', ask: 2, bid: 1 });
    await assert.rejects(repo.importRecords({ gold: [
      { action: 'insert', record: { date: '2024-02-01', ask: 3, bid: 2 } },
      { action: 'replace', existingId: 'missing', record: { date: '2024-03-01', ask: 4, bid: 3 } },
    ] }));
    assert.deepEqual((await repo.listGold()).map(row => row.id), ['keep']);
  });
});

test('17 existing custom benchmark currency wins', async () => {
  await withRepo(async repo => {
    await repo.putCustomBenchmark({ id: 'b1', name: 'Index', currency: 'EGP', data: [] });
    const [merged] = await repo.bulkUpsertCustomBenchmarks([{ id: 'incoming', name: 'Index', currency: 'USD', data: [] }]);
    assert.equal(merged.id, 'b1');
    assert.equal(merged.currency, 'EGP');
  });
});

test('18 custom benchmark dates merge, replace and sort', async () => {
  await withRepo(async repo => {
    await repo.putCustomBenchmark({ id: 'b1', name: 'Index', data: [{ date: '2024-03-01', value: 3 }, { date: '2024-01-01', value: 1 }] });
    const [merged] = await repo.bulkUpsertCustomBenchmarks([{ name: 'Index', data: [{ date: '2024-02-01', value: 2 }, { date: '2024-01-01', value: 99 }] }]);
    assert.deepEqual(merged.data, [{ date: '2024-01-01', value: 99 }, { date: '2024-02-01', value: 2 }, { date: '2024-03-01', value: 3 }]);
  });
});

test('19 backup export uses repository-backed state', async () => {
  await withRepo(async repo => {
    await repo.replaceState(sampleState());
    const backup = buildBackup(await repo.loadState());
    assert.equal(validateBackup(backup).ok, true);
    assert.equal(backup.state.cashflows[0].quantity, 21.875);
  });
});

test('20 validated backup restore replaces state atomically', async () => {
  await withRepo(async repo => {
    await repo.replaceState(sampleState());
    const replacement = sampleState();
    replacement.investments[0].name = 'Restored';
    const backup = buildBackup(replacement);
    assert.equal(validateBackup(backup).ok, true);
    await repo.replaceState(backup.state);
    assert.equal((await repo.listInvestments())[0].name, 'Restored');
    const before = await repo.loadState();
    await assert.rejects(repo.replaceState({ investments: {} }));
    assert.deepEqual(await repo.loadState(), before);
  });
});

test('21 state round-trip preserves unknown user fields and precision', async () => {
  await withRepo(async repo => {
    const state = sampleState();
    await repo.replaceState(state);
    const loaded = await repo.loadState();
    assert.equal(loaded.investments[0].extraField, 'keep-me');
    assert.equal(loaded.cashflows[0].extraFlow, 'keep-me');
    assert.equal(loaded.cashflows[0].fees, 7.89);
    assert.deepEqual(loaded.scenarios[0].arbitrary, { nested: true });
  });
});
