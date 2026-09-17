// Minimal arbitrary-precision decimal via BigInt (10 fractional digits).
// Avoids binary floating-point contamination of monetary values.
const SCALE = 10n ** 10n;
const SCALE_NUM = 1e10;

function fromValue(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid number for decimal');
    return BigInt(Math.round(value * SCALE_NUM));
  }
  if (typeof value === 'string') return parseString(value);
  if (value == null) return 0n;
  throw new Error('Invalid decimal input: ' + typeof value);
}

function parseString(s) {
  s = String(s).trim();
  if (s === '') return 0n;
  let neg = false;
  if (s[0] === '-') { neg = true; s = s.slice(1); }
  else if (s[0] === '+') { s = s.slice(1); }
  if (s.includes('e') || s.includes('E')) {
    return BigInt(Math.round(Number(s) * SCALE_NUM)) * (neg ? -1n : 1n);
  }
  const [intPartRaw, fracPartRaw = ''] = s.split('.');
  const intPart = (intPartRaw.replace(/^0+/, '') || '0');
  const fracPart = fracPartRaw.slice(0, 10).padEnd(10, '0');
  let big = BigInt(intPart) * SCALE + BigInt(fracPart);
  return neg ? -big : big;
}

export function D(value) { return fromValue(value); }
export function add(a, b) { return fromValue(a) + fromValue(b); }
export function sub(a, b) { return fromValue(a) - fromValue(b); }
export function mul(a, b) {
  const p = fromValue(a) * fromValue(b);
  const half = SCALE / 2n;
  return p >= 0n ? (p + half) / SCALE : -((-p + half) / SCALE);
}
export function div(a, b) {
  const sa = fromValue(a);
  const sb = fromValue(b);
  if (sb === 0n) throw new Error('Division by zero');
  const scaled = sa * SCALE;
  const absB = sb < 0n ? -sb : sb;
  const half = absB / 2n;
  let r;
  if (scaled >= 0n) r = (scaled + half) / absB;
  else r = -((-scaled + half) / absB);
  return sb < 0n ? -r : r;
}
export function cmp(a, b) {
  const d = fromValue(a) - fromValue(b);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}
export function isZero(a) { return fromValue(a) === 0n; }
export function lt(a, b) { return fromValue(a) < fromValue(b); }
export function gt(a, b) { return fromValue(a) > fromValue(b); }
export function toNumber(a) { return Number(fromValue(a)) / SCALE_NUM; }
export function toFixed(a, decimals = 2) { return toNumber(a).toFixed(decimals); }