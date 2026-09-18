// Full-state backup / restore — versioned, validated, atomic. Local-first: the
// backup is a plain JSON document containing all user-owned application state.
// Restore validates structure + version BEFORE touching the store, so a failed
// or corrupt restore never leaves partially replaced state.

export const BACKUP_FORMAT = 'pia-backup';
export const BACKUP_VERSION = 1;

export function buildBackup(state) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: 'Investment Analysis',
    state: {
      investments: state.investments || [],
      cashflows: state.cashflows || [],
      gold: state.gold || [],
      fx: state.fx || [],
      cpi: state.cpi || [],
      customBenchmarks: state.customBenchmarks || [],
      scenarios: state.scenarios || [],
      settings: state.settings || {},
    },
  };
}

// Returns { ok, error, preview }. ok=false => reject without touching state.
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'Backup is not a valid JSON object.' };
  if (obj.format !== BACKUP_FORMAT) return { ok: false, error: `Wrong format: expected "${BACKUP_FORMAT}".` };
  if (typeof obj.version !== 'number') return { ok: false, error: 'Backup is missing a numeric version.' };
  if (obj.version > BACKUP_VERSION) return { ok: false, error: `Backup version ${obj.version} is newer than supported (${BACKUP_VERSION}). Upgrade the app first.` };
  const st = obj.state;
  if (!st || typeof st !== 'object') return { ok: false, error: 'Backup is missing its state payload.' };
  const arrays = ['investments', 'cashflows', 'gold', 'fx', 'cpi', 'customBenchmarks', 'scenarios'];
  for (const k of arrays) {
    if (st[k] != null && !Array.isArray(st[k])) return { ok: false, error: `Backup field "${k}" must be an array.` };
  }
  if (st.settings != null && (typeof st.settings !== 'object' || Array.isArray(st.settings))) return { ok: false, error: 'Backup settings must be an object.' };
  // Referential integrity: transactions must reference real investments (allow orphans
  // only when the referenced investment is also in the backup, which is the normal case).
  const invIds = new Set((st.investments || []).map(i => i.id));
  const orphans = (st.cashflows || []).filter(c => c.investmentId && !invIds.has(c.investmentId));
  const preview = {
    investments: (st.investments || []).length,
    cashflows: (st.cashflows || []).length,
    gold: (st.gold || []).length,
    fx: (st.fx || []).length,
    cpi: (st.cpi || []).length,
    customBenchmarks: (st.customBenchmarks || []).length,
    scenarios: (st.scenarios || []).length,
    orphanTransactions: orphans.length,
    createdAt: obj.createdAt || null,
    version: obj.version,
  };
  return { ok: true, error: null, preview };
}