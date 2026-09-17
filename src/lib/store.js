import { sampleState, emptyState, defaultSettings } from './sampleData';

const KEY = 'pia.state.v1';
const listeners = new Set();
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalize(parsed);
    }
  } catch (e) { /* ignore */ }
  return sampleState();
}

function normalize(s) {
  return {
    investments: s.investments || [],
    cashflows: s.cashflows || [],
    gold: s.gold || [],
    fx: s.fx || [],
    cpi: s.cpi || [],
    settings: { ...defaultSettings(), ...(s.settings || {}) },
  };
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
function emit() { listeners.forEach(l => l()); }

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getState() { return state; }

function update(updater) {
  state = normalize(updater(state));
  persist();
  emit();
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Investments ----------
export function addInvestment(data) {
  const item = { ...data, id: uid('inv'), createdDate: new Date().toISOString(), updatedDate: new Date().toISOString() };
  update(s => ({ ...s, investments: [...s.investments, item] }));
  return item;
}
export function updateInvestment(id, patch) {
  update(s => ({ ...s, investments: s.investments.map(i => i.id === id ? { ...i, ...patch, updatedDate: new Date().toISOString() } : i) }));
}
export function deleteInvestment(id) {
  update(s => ({
    ...s,
    investments: s.investments.filter(i => i.id !== id),
    cashflows: s.cashflows.filter(c => c.investmentId !== id),
    settings: s.settings.selectedInvestmentId === id ? { ...s.settings, selectedInvestmentId: null } : s.settings,
  }));
}

// ---------- Cash flows ----------
export function addCashFlow(data) {
  const item = { ...data, id: uid('cf') };
  update(s => ({ ...s, cashflows: [...s.cashflows, item] }));
  return item;
}
export function updateCashFlow(id, patch) {
  update(s => ({ ...s, cashflows: s.cashflows.map(c => c.id === id ? { ...c, ...patch } : c) }));
}
export function deleteCashFlow(id) {
  update(s => ({ ...s, cashflows: s.cashflows.filter(c => c.id !== id) }));
}
export function duplicateCashFlow(id) {
  let copy = null;
  update(s => {
    const orig = s.cashflows.find(c => c.id === id);
    if (!orig) return s;
    copy = { ...orig, id: uid('cf'), description: (orig.description || '') + ' (copy)' };
    return { ...s, cashflows: [...s.cashflows, copy] };
  });
  return copy;
}
export function importCashFlows(records, investmentId) {
  const items = records.map(r => ({ ...r, id: uid('cf'), investmentId }));
  update(s => ({ ...s, cashflows: [...s.cashflows, ...items] }));
  return items.length;
}

// ---------- Gold ----------
export function addGold(data) { const item = { ...data, id: uid('g') }; update(s => ({ ...s, gold: [...s.gold, item] })); return item; }
export function updateGold(id, patch) { update(s => ({ ...s, gold: s.gold.map(g => g.id === id ? { ...g, ...patch } : g) })); }
export function deleteGold(id) { update(s => ({ ...s, gold: s.gold.filter(g => g.id !== id) })); }
export function importGold(records) {
  const items = records.map(r => ({ ...r, id: uid('g') }));
  update(s => ({ ...s, gold: [...s.gold, ...items] }));
  return items.length;
}

// ---------- FX ----------
export function addFx(data) { const item = { ...data, id: uid('fx') }; update(s => ({ ...s, fx: [...s.fx, item] })); return item; }
export function updateFx(id, patch) { update(s => ({ ...s, fx: s.fx.map(f => f.id === id ? { ...f, ...patch } : f) })); }
export function deleteFx(id) { update(s => ({ ...s, fx: s.fx.filter(f => f.id !== id) })); }
export function importFx(records) {
  const items = records.map(r => ({ ...r, id: uid('fx') }));
  update(s => ({ ...s, fx: [...s.fx, ...items] }));
  return items.length;
}

// ---------- CPI ----------
export function addCpi(data) { const item = { ...data, id: uid('cpi') }; update(s => ({ ...s, cpi: [...s.cpi, item] })); return item; }
export function updateCpi(id, patch) { update(s => ({ ...s, cpi: s.cpi.map(c => c.id === id ? { ...c, ...patch } : c) })); }
export function deleteCpi(id) { update(s => ({ ...s, cpi: s.cpi.filter(c => c.id !== id) })); }
export function importCpi(records) {
  const items = records.map(r => ({ ...r, id: uid('cpi') }));
  update(s => ({ ...s, cpi: [...s.cpi, ...items] }));
  return items.length;
}

// ---------- Settings ----------
export function updateSettings(patch) {
  update(s => ({ ...s, settings: { ...s.settings, ...patch } }));
}
export function setSelectedInvestment(id) {
  update(s => ({ ...s, settings: { ...s.settings, selectedInvestmentId: id } }));
}

// ---------- Bulk ----------
export function clearAll() { update(() => emptyState()); }
export function resetToSample() { update(() => sampleState()); }
export function removeDemo() {
  update(s => ({
    ...s,
    investments: s.investments.filter(i => !/DEMO/i.test(i.name || '') && !/DEMO/i.test(i.notes || '')),
    cashflows: s.cashflows.filter(c => !/DEMO/i.test(c.notes || '')),
    gold: s.gold.filter(g => !/DEMO/i.test(g.source || '') && g.quality !== 'Demo'),
    fx: s.fx.filter(f => !/DEMO/i.test(f.source || '') && f.quality !== 'Demo'),
    cpi: s.cpi.filter(c => !/DEMO/i.test(c.source || '')),
    settings: { ...s.settings, selectedInvestmentId: null },
  }));
}

export { uid };