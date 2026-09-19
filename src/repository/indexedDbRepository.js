import { openDB } from 'idb';

export const V2_SCHEMA_VERSION = 1;
export const V1_LOCAL_STORAGE_KEY = 'pia.state.v1';

const DEFAULT_DB_NAME = 'investcompare-v2';
const META_STORE = 'meta';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'app';
const META_MIGRATION_KEY = 'v1-migration';
const COLLECTION_STORES = ['investments', 'cashflows', 'gold', 'fx', 'cpi', 'customBenchmarks', 'scenarios'];
const IMPORT_STORES = ['investments', 'cashflows', 'gold', 'fx', 'cpi'];
const IMPORT_PREFIX = { investments: 'inv', cashflows: 'cf', gold: 'g', fx: 'fx', cpi: 'cpi' };

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRecordArray(value) {
  return Array.isArray(value) && value.every(item => isObject(item) && typeof item.id === 'string');
}

export function isValidV1State(raw) {
  if (!isObject(raw)) return false;
  for (const store of COLLECTION_STORES) {
    if (raw[store] !== undefined && !isRecordArray(raw[store])) return false;
  }
  return raw.settings === undefined || isObject(raw.settings);
}

function normalizeV1State(raw) {
  return {
    ...Object.fromEntries(COLLECTION_STORES.map(store => [store, raw[store] || []])),
    settings: raw.settings || {},
  };
}

function isValidCompleteState(raw) {
  return isValidV1State(raw) && COLLECTION_STORES.every(store => isRecordArray(raw[store]));
}

function isStateEmpty(state) {
  return COLLECTION_STORES.every(store => state[store].length === 0) && Object.keys(state.settings || {}).length === 0;
}

async function writeStateTransaction(db, state, includeMigrationMarker = false) {
  const stores = [...COLLECTION_STORES, SETTINGS_STORE, ...(includeMigrationMarker ? [META_STORE] : [])];
  const tx = db.transaction(stores, 'readwrite');
  for (const store of COLLECTION_STORES) {
    const target = tx.objectStore(store);
    await target.clear();
    for (const record of state[store] || []) await target.put(record);
  }
  const settings = tx.objectStore(SETTINGS_STORE);
  await settings.clear();
  await settings.put({ key: SETTINGS_KEY, value: state.settings || {} });
  if (includeMigrationMarker) {
    for (const store of COLLECTION_STORES) {
      const actual = await tx.objectStore(store).count();
      if (actual !== (state[store] || []).length) {
        tx.abort();
        await tx.done.catch(() => {});
        throw new Error(`Migration count verification failed for '${store}'.`);
      }
    }
    await tx.objectStore(META_STORE).put({ key: META_MIGRATION_KEY, value: { completedAt: new Date().toISOString() } });
  }
  await tx.done;
}

class IndexedDbRepository {
  constructor({ dbName = DEFAULT_DB_NAME } = {}) {
    this.dbName = dbName;
    this.db = null;
  }

  async init() {
    if (this.db) return;
    this.db = await openDB(this.dbName, V2_SCHEMA_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('investments')) database.createObjectStore('investments', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('cashflows')) {
          const store = database.createObjectStore('cashflows', { keyPath: 'id' });
          store.createIndex('investmentId', 'investmentId');
        }
        for (const name of ['gold', 'fx', 'cpi', 'customBenchmarks', 'scenarios']) {
          if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(SETTINGS_STORE)) database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
      },
    });
  }

  requireDb() {
    if (!this.db) throw new Error('Repository not initialized. Call init() first.');
    return this.db;
  }

  async close() {
    if (this.db) this.db.close();
    this.db = null;
  }

  async getSchemaVersion() { return this.requireDb().version; }

  async loadState() {
    const db = this.requireDb();
    const [investments, cashflows, gold, fx, cpi, customBenchmarks, scenarios, settings] = await Promise.all([
      db.getAll('investments'), db.getAll('cashflows'), db.getAll('gold'), db.getAll('fx'), db.getAll('cpi'),
      db.getAll('customBenchmarks'), db.getAll('scenarios'), db.get(SETTINGS_STORE, SETTINGS_KEY),
    ]);
    return { investments, cashflows, gold, fx, cpi, customBenchmarks, scenarios, settings: settings?.value || {} };
  }

  async replaceState(state) {
    if (!isValidCompleteState(state)) throw new Error('Invalid state replacement payload.');
    await writeStateTransaction(this.requireDb(), state);
  }

  async listInvestments() { return this.requireDb().getAll('investments'); }
  async putInvestment(record) { await this.requireDb().put('investments', record); }
  async deleteInvestment(id) {
    const db = this.requireDb();
    const tx = db.transaction(['investments', 'cashflows', SETTINGS_STORE], 'readwrite');
    await tx.objectStore('investments').delete(id);
    let cursor = await tx.objectStore('cashflows').index('investmentId').openCursor(IDBKeyRange.only(id));
    while (cursor) { await cursor.delete(); cursor = await cursor.continue(); }
    const settingsStore = tx.objectStore(SETTINGS_STORE);
    const settings = await settingsStore.get(SETTINGS_KEY);
    if (settings?.value?.selectedInvestmentId === id) {
      await settingsStore.put({ ...settings, value: { ...settings.value, selectedInvestmentId: null } });
    }
    await tx.done;
  }

  async listCashflows(investmentId) {
    const db = this.requireDb();
    return investmentId === undefined
      ? db.getAll('cashflows')
      : db.getAllFromIndex('cashflows', 'investmentId', IDBKeyRange.only(investmentId));
  }
  async putCashflow(record) { await this.requireDb().put('cashflows', record); }
  async deleteCashflow(id) { await this.requireDb().delete('cashflows', id); }

  async listGold() { return this.requireDb().getAll('gold'); }
  async putGold(record) { await this.requireDb().put('gold', record); }
  async deleteGold(id) { await this.requireDb().delete('gold', id); }
  async listFx() { return this.requireDb().getAll('fx'); }
  async putFx(record) { await this.requireDb().put('fx', record); }
  async deleteFx(id) { await this.requireDb().delete('fx', id); }
  async listCpi() { return this.requireDb().getAll('cpi'); }
  async putCpi(record) { await this.requireDb().put('cpi', record); }
  async deleteCpi(id) { await this.requireDb().delete('cpi', id); }
  async listCustomBenchmarks() { return this.requireDb().getAll('customBenchmarks'); }
  async putCustomBenchmark(record) { await this.requireDb().put('customBenchmarks', record); }
  async deleteCustomBenchmark(id) { await this.requireDb().delete('customBenchmarks', id); }
  async listScenarios() { return this.requireDb().getAll('scenarios'); }
  async putScenario(record) { await this.requireDb().put('scenarios', record); }
  async deleteScenario(id) { await this.requireDb().delete('scenarios', id); }
  async getSettings() { return (await this.requireDb().get(SETTINGS_STORE, SETTINGS_KEY))?.value || {}; }
  async putSettings(settings) { await this.requireDb().put(SETTINGS_STORE, { key: SETTINGS_KEY, value: settings }); }

  async importRecords(plan) {
    const db = this.requireDb();
    const stores = IMPORT_STORES.filter(store => (plan[store] || []).length > 0);
    if (!stores.length) return { inserted: 0, replaced: 0, skipped: 0 };
    for (const store of stores) {
      for (const entry of plan[store]) {
        if (!['insert', 'replace', 'skip'].includes(entry.action)) throw new Error(`Invalid import action '${entry.action}'.`);
        if (entry.action === 'replace' && !entry.existingId) throw new Error(`Replace in '${store}' requires existingId.`);
        if (!isObject(entry.record)) throw new Error(`Import record for '${store}' is invalid.`);
      }
    }
    const tx = db.transaction(stores, 'readwrite');
    let inserted = 0, replaced = 0, skipped = 0;
    const now = new Date().toISOString();
    try {
      for (const store of stores) {
        const target = tx.objectStore(store);
        for (const entry of plan[store]) {
          if (entry.action === 'skip') { skipped++; continue; }
          if (entry.action === 'insert') {
            const record = { ...entry.record, id: entry.record.id || uid(IMPORT_PREFIX[store]) };
            if (store === 'investments') {
              record.createdDate ||= now;
              record.updatedDate ||= now;
            }
            await target.put(record);
            inserted++;
          } else {
            const existing = await target.get(entry.existingId);
            if (!existing) throw new Error(`Cannot replace missing '${store}' record '${entry.existingId}'.`);
            const record = { ...entry.record, id: entry.existingId };
            if (store === 'investments') {
              record.createdDate = existing.createdDate || now;
              record.updatedDate = now;
            }
            await target.put(record);
            replaced++;
          }
        }
      }
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* already inactive */ }
      await tx.done.catch(() => {});
      throw error;
    }
    return { inserted, replaced, skipped };
  }

  async bulkUpsertCustomBenchmarks(records) {
    const tx = this.requireDb().transaction('customBenchmarks', 'readwrite');
    const store = tx.objectStore('customBenchmarks');
    const existingByName = new Map((await store.getAll()).map(record => [record.name, record]));
    const groups = new Map();
    for (const record of records) {
      if (!groups.has(record.name)) groups.set(record.name, []);
      groups.get(record.name).push(record);
    }
    const results = [];
    for (const [name, group] of groups) {
      const existing = existingByName.get(name);
      const byDate = new Map((existing?.data || []).map(point => [point.date, point]));
      for (const incoming of group) for (const point of incoming.data || []) byDate.set(point.date, { ...point });
      const first = group[0];
      const merged = {
        ...(existing || first),
        id: existing?.id || first.id || uid('cb'),
        name,
        currency: existing?.currency || group.find(item => item.currency)?.currency || 'EGP',
        data: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      };
      await store.put(merged);
      results.push(merged);
    }
    await tx.done;
    return results;
  }

  async migrateFromV1LocalStorage(storage, fallbackState) {
    const db = this.requireDb();
    const marker = await db.get(META_STORE, META_MIGRATION_KEY);
    if (marker) return { migrated: false, reason: 'already-migrated', counts: await this.counts() };
    const raw = storage?.getItem?.(V1_LOCAL_STORAGE_KEY);
    let source = null;
    let reason = 'no-v1-data';
    if (raw !== null && raw !== undefined) {
      try { source = JSON.parse(raw); } catch { return { migrated: false, reason: 'invalid-v1-data' }; }
      if (!isValidV1State(source)) return { migrated: false, reason: 'invalid-v1-data' };
      source = normalizeV1State(source);
      reason = 'migrated';
    } else if (fallbackState) {
      if (!isValidCompleteState(fallbackState)) throw new Error('Invalid fallback state.');
      source = fallbackState;
    }
    if (!source) return { migrated: false, reason };
    await writeStateTransaction(db, source, true);
    const counts = await this.counts();
    return { migrated: reason === 'migrated', reason, counts };
  }

  async counts() {
    const db = this.requireDb();
    const values = await Promise.all(COLLECTION_STORES.map(store => db.count(store)));
    return Object.fromEntries(COLLECTION_STORES.map((store, index) => [store, values[index]]));
  }

  async isEmpty() { return isStateEmpty(await this.loadState()); }
}

export function createIndexedDbRepository(options) {
  return new IndexedDbRepository(options);
}
