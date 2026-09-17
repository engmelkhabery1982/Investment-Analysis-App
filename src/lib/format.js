import { toNumber } from './decimal';

export function fmtMoney(value, decimals = 2, currency = 'EGP') {
  const n = value == null ? NaN : toNumber(value);
  if (!isFinite(n)) return '—';
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtNumber(value, decimals = 4) {
  const n = value == null ? NaN : toNumber(value);
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// fraction is a decimal ratio (0.6 => 60%)
export function fmtPct(fraction, decimals = 2) {
  if (fraction == null) return '—';
  const n = typeof fraction === 'bigint' ? toNumber(fraction) : Number(fraction);
  if (!isFinite(n)) return '—';
  return (n * 100).toFixed(decimals) + '%';
}

export function fmtDate(d) {
  if (!d) return '—';
  return d; // stored as YYYY-MM-DD
}

export function fmtSigned(value, decimals = 2, currency = 'EGP') {
  const n = value == null ? NaN : toNumber(value);
  if (!isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${currency} ${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`.replace(`${currency} `, `${sign ? '+' : ''}${currency} `);
}