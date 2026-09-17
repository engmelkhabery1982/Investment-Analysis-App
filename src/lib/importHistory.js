// Lightweight LOCAL import history. No backend, no entities.
// Stored in localStorage alongside the main app state.
const KEY = 'pia.importHistory.v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return [];
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

export function getImportHistory() {
  return load();
}

export function addImportHistoryEntry(entry) {
  const list = load();
  const item = { id: `ih-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(), ...entry };
  list.unshift(item);
  save(list.slice(0, 100));
  return item;
}

export function clearImportHistory() {
  save([]);
}