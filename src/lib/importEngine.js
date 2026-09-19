// Professional Data Import engine — pure, portable, no React or platform deps.
// Handles: delimited parsing (CSV/TSV/paste), XLSX, column auto-mapping,
// date/number normalization, validation, and duplicate/conflict detection.

import { parseCSV } from './csv';
import { INVESTMENT_TYPES, INVESTMENT_STATUSES, DIRECTIONS, TRANSACTION_TYPES } from './model';

// ---------------------------------------------------------------------------
// Type / field configuration (single source of truth, reused by UI & tests)
// ---------------------------------------------------------------------------
// Each field: { key, label, required, numeric, aliases[], pattern? }
// pattern: optional regex tested against the lowercased header to map virtual fields.

export const IMPORT_TYPES = {
  cashflow: {
    label: 'Cash Flows',
    description: 'Investment payment records (date, amount, currency, installment, status).',
    collectionKey: 'cashflows',
    fields: [
      { key: 'date', label: 'Payment Date', required: true, aliases: ['date', 'payment date', 'payment_date', 'transaction date', 'transactiondate', 'pay date', 'paymentdate', 'paid date'] },
      { key: 'amount', label: 'Amount', required: true, numeric: true, aliases: ['amount', 'value', 'payment', 'paid amount', 'paidamount', 'payment amount', 'amount paid', 'cost', 'price'] },
      { key: 'direction', label: 'Direction', aliases: ['direction', 'transaction direction', 'transaction_direction', 'cash flow direction', 'cashflow direction', 'flow direction'] },
      { key: 'transactionType', label: 'Transaction Type', aliases: ['transaction type', 'transactiontype', 'transaction_type', 'cash flow type', 'cashflow type'] },
      { key: 'quantity', label: 'Quantity', numeric: true, aliases: ['quantity', 'qty', 'units', 'number of units'] },
      { key: 'unitPrice', label: 'Unit Price', numeric: true, aliases: ['unit price', 'unitprice', 'unit_price', 'price per unit'] },
      { key: 'fees', label: 'Fees', numeric: true, aliases: ['fees', 'fee', 'transaction fees', 'transaction fee'] },
      { key: 'currency', label: 'Currency', aliases: ['currency', 'curr', 'ccy'] },
      { key: 'description', label: 'Description', aliases: ['description', 'desc', 'details', 'detail', 'narration'] },
      { key: 'installmentNumber', label: 'Installment Number', numeric: true, aliases: ['installmentnumber', 'installment number', 'installment', 'installment_number', 'installment no', 'installmentno', 'installment #', 'inst'] },
      { key: 'paymentType', label: 'Payment Type', aliases: ['paymenttype', 'payment type', 'payment_type'], pattern: /^type$/ },
      { key: 'status', label: 'Status', aliases: ['status', 'state'] },
      { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'remarks', 'comment', 'comments'] },
    ],
    defaults: (settings) => ({ currency: settings.defaultCurrency || 'EGP', direction: 'outflow', paymentType: 'Installment', status: 'paid', quality: 'Imported' }),
  },
  gold: {
    label: 'Gold Prices',
    description: 'Historical gold prices per date, karat and unit. Ask = investor buy price, Bid = investor sell price.',
    collectionKey: 'gold',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'price date', 'pricedate', 'as of date', 'asofdate', 'report date'] },
      { key: 'karat', label: 'Karat', aliases: ['karat', 'gold type', 'goldtype', 'type', 'purity', 'karat type', 'gold karat'] },
      { key: 'unit', label: 'Unit', aliases: ['unit', 'u', 'measure', 'uom'] },
      { key: 'ask', label: 'Ask (investor buys)', required: true, numeric: true, aliases: ['ask', 'ask price', 'askprice', 'sell', 'selling price', 'sellingprice', 'selling', 'consumer buy price', 'consumerbuyprice', 'consumer buy', 'ask (egp)'] },
      { key: 'bid', label: 'Bid (investor sells)', required: true, numeric: true, aliases: ['bid', 'bid price', 'bidprice', 'buy', 'buying price', 'buyingprice', 'buying', 'bid (egp)'] },
      { key: 'source', label: 'Source', aliases: ['source', 'src', 'provider'] },
      { key: 'quality', label: 'Data Quality', aliases: ['quality', 'data quality', 'dataquality', 'data status', 'datastatus'] },
      { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'remarks'] },
    ],
    defaults: (settings) => ({ karat: settings.defaultGoldType || '21K', unit: 'gram', quality: 'Imported' }),
  },
  fx: {
    label: 'FX Rates',
    description: 'Historical foreign-exchange rates. Direction is preserved — never inverted. Quote should be EGP.',
    collectionKey: 'fx',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'rate date', 'ratedate', 'as of date', 'asofdate', 'report date'] },
      { key: 'pair', label: 'Currency Pair (e.g. USD/EGP)', aliases: ['pair', 'currency pair', 'currencypair', 'currency', 'instrument', 'symbol', 'ticker'], pattern: /^[a-z]{3}\/[a-z]{3}$/ },
      { key: 'base', label: 'Base Currency', aliases: ['base', 'basecurrency', 'base currency', 'from', 'fromcurrency', 'foreign'] },
      { key: 'quote', label: 'Quote Currency', aliases: ['quote', 'quotecurrency', 'quote currency', 'to', 'tocurrency'] },
      { key: 'bid', label: 'Bid', required: true, numeric: true, aliases: ['bid', 'bid price', 'bidprice'] },
      { key: 'ask', label: 'Ask', required: true, numeric: true, aliases: ['ask', 'ask price', 'askprice'] },
      { key: 'source', label: 'Source', aliases: ['source', 'src', 'provider'] },
      { key: 'quality', label: 'Data Quality', aliases: ['quality', 'data quality', 'dataquality'] },
      { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'remarks'] },
    ],
    defaults: () => ({ base: 'USD', quote: 'EGP', quality: 'Imported' }),
  },
  cpi: {
    label: 'Inflation / CPI',
    description: 'Consumer Price Index values by effective date and country. CPI must be positive.',
    collectionKey: 'cpi',
    fields: [
      { key: 'effectiveDate', label: 'Effective Date', required: true, aliases: ['date', 'effectivedate', 'effective date', 'month', 'period', 'report date'] },
      { key: 'cpiValue', label: 'CPI Value', required: true, numeric: true, aliases: ['cpi', 'cpivalue', 'cpi value', 'value', 'index', 'consumer price index', 'consumerpriceindex', 'inflation', 'inflation index'] },
      { key: 'frequency', label: 'Frequency', aliases: ['frequency', 'freq'] },
      { key: 'country', label: 'Country', aliases: ['country', 'region'] },
      { key: 'source', label: 'Source', aliases: ['source', 'src', 'provider'] },
      { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'remarks'] },
    ],
    defaults: () => ({ frequency: 'monthly', country: 'Egypt' }),
  },
  investment: {
    label: 'Investments',
    description: 'Investment records (name, type, status, currency, valuation). Creates new investments; assign transactions separately.',
    collectionKey: 'investments',
    fields: [
      { key: 'name', label: 'Name', required: true, aliases: ['name', 'investment', 'title', 'investment name'] },
      { key: 'type', label: 'Type', aliases: ['type', 'investment type', 'investmenttype', 'asset type', 'assettype', 'category'] },
      { key: 'status', label: 'Status', aliases: ['status', 'state'] },
      { key: 'baseCurrency', label: 'Base Currency', aliases: ['basecurrency', 'base currency', 'currency', 'ccy'] },
      { key: 'valuationDate', label: 'Valuation Date', aliases: ['valuationdate', 'valuation date', 'as of date', 'asofdate', 'report date'] },
      { key: 'currentValuation', label: 'Current / Terminal Value', numeric: true, aliases: ['currentvaluation', 'current valuation', 'current value', 'currentvalue', 'terminal value', 'terminalvalue', 'value', 'market value', 'marketvalue'] },
      { key: 'contractDate', label: 'Contract Date', aliases: ['contractdate', 'contract date', 'purchase date', 'purchasedate', 'start date', 'startdate'] },
      { key: 'location', label: 'Location', aliases: ['location', 'address', 'region'] },
      { key: 'description', label: 'Description', aliases: ['description', 'desc', 'notes', 'note'] },
    ],
    defaults: (settings) => ({ type: 'real_estate', status: 'Active', baseCurrency: settings.defaultCurrency || 'EGP' }),
  },
  custombenchmark: {
    label: 'Custom Benchmark Data',
    description: 'Price / index series for a custom benchmark. Rows are grouped by benchmark name; dates must be unique per benchmark.',
    collectionKey: 'customBenchmarks',
    fields: [
      { key: 'name', label: 'Benchmark Name', required: true, aliases: ['name', 'benchmark', 'benchmark name', 'series'] },
      { key: 'currency', label: 'Currency', aliases: ['currency', 'ccy'] },
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'as of date', 'asofdate', 'price date', 'pricedate'] },
      { key: 'value', label: 'Value / Price', required: true, numeric: true, aliases: ['value', 'price', 'close', 'index', 'level'] },
      { key: 'source', label: 'Source', aliases: ['source', 'src', 'provider'] },
    ],
    defaults: (settings) => ({ currency: settings.defaultCurrency || 'EGP' }),
  },
};

export const TYPE_ORDER = ['cashflow', 'gold', 'fx', 'cpi', 'investment', 'custombenchmark'];

// ---------------------------------------------------------------------------
// Delimited parsing
// ---------------------------------------------------------------------------
export function detectDelimiter(text) {
  const sample = text.split('\n').slice(0, 5).join('\n');
  if (sample.includes('\t')) return '\t';
  if (sample.includes(';') && !sample.includes(',')) return ';';
  return ',';
}

export function parseDelimited(text, delimiter) {
  if (delimiter === ',') return parseCSV(text);
  // Generic parser for tab / semicolon with quote support.
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && !(r.length === 1 && r[0].trim() === ''));
}

export function parseClipboard(text) {
  const delim = detectDelimiter(text);
  return { delimiter: delim, rows: parseDelimited(text, delim) };
}

// XLSX parsing via SheetJS. Returns { rows } (array of arrays, header in row 0).
export async function parseXlsxFile(file) {
  const XLSX = await import('xlsx');
  const buf = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', blankrows: false });
  // Normalize every cell to a string and drop fully-empty rows.
  return rows
    .map(r => (r || []).map(c => (c == null ? '' : String(c).trim())))
    .filter(r => r.length && r.some(c => c !== ''));
}

export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) {
    return { rows: await parseXlsxFile(file), fileName: file.name, kind: 'xlsx' };
  }
  const text = await file.text();
  const { rows } = parseClipboard(text);
  return { rows, fileName: file.name, kind: 'csv' };
}

// ---------------------------------------------------------------------------
// Header detection + column auto-mapping
// ---------------------------------------------------------------------------
export function extractHeaders(rows) {
  if (!rows || !rows.length) return [];
  // A header row is one where at least one cell is non-numeric non-empty text.
  const first = rows[0];
  const looksHeader = first.some(c => {
    const t = (c || '').trim();
    return t && isNaN(Number(t.replace(/[,\s]/g, ''))) && !/^\d{4}[-/.]\d/.test(t);
  });
  return { hasHeader: looksHeader, headers: first.map((h, i) => (h || '').trim() || `Column ${i + 1}`), dataRows: looksHeader ? rows.slice(1) : rows };
}

export function autoMapColumns(headers, type) {
  const cfg = IMPORT_TYPES[type];
  const lower = headers.map(h => h.toLowerCase().trim());
  const map = {};
  for (const f of cfg.fields) {
    // exact alias match first
    let idx = -1;
    for (const a of f.aliases) {
      idx = lower.indexOf(a);
      if (idx >= 0) break;
    }
    // pattern match (e.g. USD/EGP)
    if (idx < 0 && f.pattern) {
      idx = lower.findIndex(h => f.pattern.test(h));
    }
    // contains match
    if (idx < 0) {
      idx = lower.findIndex(h => f.aliases.some(a => h.includes(a)));
    }
    if (idx >= 0) map[f.key] = idx;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------
function isValidISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// fmt: 'auto' | 'ymd' | 'dmy' | 'mdy'
export function parseDateField(str, fmt = 'auto') {
  if (str == null || String(str).trim() === '') return { iso: null, error: 'Date is required' };
  const s = String(str).trim();
  // ISO YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const iso = `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
    if (!isValidISO(iso)) return { iso: null, error: `Invalid calendar date: ${iso}` };
    return { iso, raw: s };
  }
  // DD/MM/YYYY or MM/DD/YYYY with / - .
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3];
    let day, month, ambiguous = false;
    if (fmt === 'dmy') { day = a; month = b; }
    else if (fmt === 'mdy') { month = a; day = b; }
    else {
      if (a > 12 && b <= 12) { day = a; month = b; }
      else if (b > 12 && a <= 12) { month = a; day = b; }
      else { ambiguous = true; day = a; month = b; } // default DMY, but flag
    }
    if (month < 1 || month > 12) return { iso: null, error: `Invalid month: ${month}`, raw: s };
    if (day < 1 || day > 31) return { iso: null, error: `Invalid day: ${day}`, raw: s };
    const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!isValidISO(iso)) return { iso: null, error: `Invalid calendar date: ${iso}`, raw: s };
    return { iso, ambiguous, raw: s };
  }
  // Fallback: let JS Date parse (handles datetime strings)
  const dt = new Date(s);
  if (!isNaN(dt)) {
    const iso = dt.toISOString().slice(0, 10);
    if (isValidISO(iso)) return { iso, raw: s };
  }
  return { iso: null, error: `Unrecognized date format: "${s}"`, raw: s };
}

// ---------------------------------------------------------------------------
// Numeric parsing
// ---------------------------------------------------------------------------
// fmt: 'auto' | 'us' | 'eu'
export function parseNumber(str, fmt = 'auto') {
  if (str == null) return { value: null, error: 'Missing value' };
  if (typeof str === 'number') return { value: str };
  const raw = String(str).trim();
  let s = raw.replace(/[^\d.,\-]/g, ''); // strip currency symbols & spaces
  if (s === '' || s === '-' || s === '.' || s === ',') return { value: null, error: `No digits: "${raw}"` };
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  let normalized;
  if (fmt === 'us') {
    normalized = s.replace(/,/g, '');
  } else if (fmt === 'eu') {
    normalized = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  } else if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) normalized = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
    else normalized = s.replace(/,/g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length === 3) normalized = s.replace(/,/g, ''); // 100,000 -> 100000
    else if (parts.length === 2 && parts[1].length !== 3) normalized = s.replace(/,/g, '.'); // 100,50 -> 100.50
    else normalized = s.replace(/,/g, '');
  } else {
    normalized = s; // dot or plain -> decimal
  }
  const n = Number(normalized);
  if (!isFinite(n)) return { value: null, error: `Invalid number: "${raw}"` };
  return { value: n };
}

// ---------------------------------------------------------------------------
// Record building per type
// ---------------------------------------------------------------------------
function pick(row, map, key) {
  const idx = map[key];
  if (idx == null || idx < 0) return '';
  return (row[idx] == null ? '' : String(row[idx]).trim());
}

export function buildRecord(type, row, map, opts) {
  const cfg = IMPORT_TYPES[type];
  const settings = opts.settings || {};
  const d = cfg.defaults(settings);
  const num = (v) => parseNumber(v, opts.numberFormat);
  switch (type) {
    case 'cashflow': {
      const di = parseDateField(pick(row, map, 'date'), opts.dateFormat);
      const amt = num(pick(row, map, 'amount'));
      const rawDir = pick(row, map, 'direction').toLowerCase();
      const direction = !rawDir
        ? d.direction
        : DIRECTIONS.some(x => x.value === rawDir)
          ? rawDir
          : rawDir === 'in'
            ? 'inflow'
            : rawDir === 'out'
              ? 'outflow'
              : rawDir;
      const txType = pick(row, map, 'transactionType') || pick(row, map, 'paymentType') || d.transactionType || d.paymentType;
      return {
        date: di.iso || '',
        amount: amt.value == null ? '' : amt.value,
        direction,
        transactionType: txType,
        currency: pick(row, map, 'currency') || d.currency,
        quantity: pick(row, map, 'quantity') ? num(pick(row, map, 'quantity')).value : '',
        unitPrice: pick(row, map, 'unitPrice') ? num(pick(row, map, 'unitPrice')).value : '',
        fees: pick(row, map, 'fees') ? num(pick(row, map, 'fees')).value : '',
        description: pick(row, map, 'description') || '',
        installmentNumber: pick(row, map, 'installmentNumber') ? num(pick(row, map, 'installmentNumber')).value : '',
        paymentType: txType, // legacy compat
        status: (pick(row, map, 'status') || d.status).toLowerCase(),
        notes: pick(row, map, 'notes') || '',
        quality: d.quality,
        _dateInfo: di,
        _amountInfo: amt,
      };
    }
    case 'gold': {
      const di = parseDateField(pick(row, map, 'date'), opts.dateFormat);
      const ask = num(pick(row, map, 'ask'));
      const bid = num(pick(row, map, 'bid'));
      const karat = pick(row, map, 'karat') || d.karat;
      const unit = pick(row, map, 'unit') || d.unit;
      return {
        date: di.iso || '',
        karat, unit,
        ask: ask.value == null ? '' : ask.value,
        bid: bid.value == null ? '' : bid.value,
        source: pick(row, map, 'source') || '',
        sourceDate: di.iso || '',
        quality: pick(row, map, 'quality') || d.quality,
        notes: pick(row, map, 'notes') || '',
        _dateInfo: di, _askInfo: ask, _bidInfo: bid,
      };
    }
    case 'fx': {
      const di = parseDateField(pick(row, map, 'date'), opts.dateFormat);
      const bid = num(pick(row, map, 'bid'));
      const ask = num(pick(row, map, 'ask'));
      let base = pick(row, map, 'base');
      let quote = pick(row, map, 'quote');
      const pair = pick(row, map, 'pair');
      if (pair && pair.includes('/')) { const [b, q] = pair.split('/'); base = base || b; quote = quote || q; }
      base = (base || d.base).toUpperCase();
      quote = (quote || d.quote).toUpperCase();
      return {
        date: di.iso || '',
        base, quote,
        bid: bid.value == null ? '' : bid.value,
        ask: ask.value == null ? '' : ask.value,
        source: pick(row, map, 'source') || '',
        quality: pick(row, map, 'quality') || d.quality,
        notes: pick(row, map, 'notes') || '',
        _dateInfo: di, _bidInfo: bid, _askInfo: ask,
      };
    }
    case 'cpi': {
      const di = parseDateField(pick(row, map, 'effectiveDate'), opts.dateFormat);
      const val = num(pick(row, map, 'cpiValue'));
      return {
        effectiveDate: di.iso || '',
        cpiValue: val.value == null ? '' : val.value,
        frequency: pick(row, map, 'frequency') || d.frequency,
        country: pick(row, map, 'country') || d.country,
        source: pick(row, map, 'source') || '',
        notes: pick(row, map, 'notes') || '',
        _dateInfo: di, _valueInfo: val,
      };
    }
    case 'investment': {
      const di = parseDateField(pick(row, map, 'valuationDate'), opts.dateFormat);
      const cdi = parseDateField(pick(row, map, 'contractDate'), opts.dateFormat);
      const val = num(pick(row, map, 'currentValuation'));
      return {
        name: pick(row, map, 'name') || '',
        type: pick(row, map, 'type') || d.type,
        status: pick(row, map, 'status') || d.status,
        baseCurrency: pick(row, map, 'baseCurrency') || d.baseCurrency,
        valuationDate: di.iso || '',
        currentValuation: val.value == null ? '' : val.value,
        contractDate: cdi.iso || '',
        location: pick(row, map, 'location') || '',
        description: pick(row, map, 'description') || '',
        _dateInfo: di, _valInfo: val,
      };
    }
    case 'custombenchmark': {
      const di = parseDateField(pick(row, map, 'date'), opts.dateFormat);
      const val = num(pick(row, map, 'value'));
      return {
        name: pick(row, map, 'name') || '',
        currency: pick(row, map, 'currency') || d.currency,
        date: di.iso || '',
        value: val.value == null ? '' : val.value,
        source: pick(row, map, 'source') || '',
        _dateInfo: di, _valueInfo: val,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Validation (import-specific: errors block, warnings flag)
// ---------------------------------------------------------------------------
export function validateImportRow(type, rec, ctx = {}) {
  const errors = [];
  const warnings = [];
  if (type === 'cashflow') {
    if (rec._dateInfo?.error) errors.push(rec._dateInfo.error);
    if (rec._amountInfo?.error) errors.push(`Amount: ${rec._amountInfo.error}`);
    if (rec.status !== 'refunded' && !(Number(rec.amount) > 0)) errors.push('Amount must be greater than 0 (unless refunded).');
    const validDirection = DIRECTIONS.some(x => x.value === rec.direction);
    if (!validDirection) errors.push(`Direction must be "outflow" or "inflow" (got "${rec.direction}").`);
    if (!rec.currency) errors.push('Currency is required.');
    if (rec.transactionType && !TRANSACTION_TYPES.outflow.includes(rec.transactionType) && !TRANSACTION_TYPES.inflow.includes(rec.transactionType)) warnings.push(`Transaction type "${rec.transactionType}" is not a standard type.`);
    if (validDirection && rec.transactionType && !TRANSACTION_TYPES[rec.direction].includes(rec.transactionType)) warnings.push(`Transaction type "${rec.transactionType}" is unusual for direction "${rec.direction}".`);
    if (rec.quantity !== '' && rec.quantity != null && !(Number(rec.quantity) >= 0)) errors.push('Quantity must be >= 0.');
    if (rec.unitPrice !== '' && rec.unitPrice != null && !(Number(rec.unitPrice) >= 0)) errors.push('Unit price must be >= 0.');
    if (rec.fees !== '' && rec.fees != null && !(Number(rec.fees) >= 0)) errors.push('Fees must be >= 0.');
    if (rec.date && ctx.valuationDate && rec.status === 'paid') {
      if (new Date(rec.date + 'T00:00:00Z') >= new Date(ctx.valuationDate + 'T00:00:00Z')) {
        errors.push('Paid payment date must be before the valuation date.');
      }
    }
  } else if (type === 'gold') {
    if (rec._dateInfo?.error) errors.push(rec._dateInfo.error);
    if (rec._askInfo?.error) errors.push(`Ask: ${rec._askInfo.error}`);
    if (rec._bidInfo?.error) errors.push(`Bid: ${rec._bidInfo.error}`);
    if (!(Number(rec.ask) > 0)) errors.push('Ask price must be greater than 0.');
    if (!(Number(rec.bid) > 0)) errors.push('Bid price must be greater than 0.');
    if (Number(rec.bid) > Number(rec.ask) && rec.bid && rec.ask) warnings.push('Bid is greater than Ask — please verify (Ask should be the investor buy price).');
    if (!rec.karat) errors.push('Gold type (karat) is required.');
  } else if (type === 'fx') {
    if (rec._dateInfo?.error) errors.push(rec._dateInfo.error);
    if (rec._bidInfo?.error) errors.push(`Bid: ${rec._bidInfo.error}`);
    if (rec._askInfo?.error) errors.push(`Ask: ${rec._askInfo.error}`);
    if (!rec.base || !rec.quote) errors.push('Currency pair is required (base/quote or a USD/EGP-style pair column).');
    if (!(Number(rec.ask) > 0)) errors.push('Ask must be greater than 0.');
    if (!(Number(rec.bid) > 0)) errors.push('Bid must be greater than 0.');
    if (Number(rec.bid) > Number(rec.ask) && rec.bid && rec.ask) warnings.push('Bid is greater than Ask — please verify.');
    if (rec.quote && rec.quote !== 'EGP') warnings.push(`Quote currency is ${rec.quote}, not EGP. Comparisons assume EGP-denominated rates; this record may be ignored by the analysis.`);
  } else if (type === 'cpi') {
    if (rec._dateInfo?.error) errors.push(rec._dateInfo.error);
    if (rec._valueInfo?.error) errors.push(`CPI value: ${rec._valueInfo.error}`);
    if (!(Number(rec.cpiValue) > 0)) errors.push('CPI value must be greater than 0.');
  } else if (type === 'investment') {
    if (!rec.name) errors.push('Investment name is required.');
    if (rec._dateInfo?.error) errors.push(rec._dateInfo.error);
    if (!rec.valuationDate) errors.push('Valuation date is required.');
    if (rec.type && !INVESTMENT_TYPES[rec.type]) errors.push(`Unknown investment type: ${rec.type}`);
    if (rec.status && !INVESTMENT_STATUSES.includes(rec.status)) errors.push(`Unknown status: ${rec.status}`);
    if (rec.currentValuation !== '' && rec.currentValuation != null && !(Number(rec.currentValuation) >= 0)) errors.push('Current value must be >= 0.');
  } else if (type === 'custombenchmark') {
    if (!rec.name) errors.push('Benchmark name is required.');
    if (rec._dateInfo?.error) errors.push(rec._dateInfo.error);
    if (rec._valueInfo?.error) errors.push(`Value: ${rec._valueInfo.error}`);
    if (!(Number(rec.value) > 0)) errors.push('Value must be greater than 0.');
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Duplicate / conflict detection
// ---------------------------------------------------------------------------
export function dupKey(type, rec, ctx = {}) {
  if (type === 'cashflow') return `${ctx.investmentId || ''}|${rec.date}|${rec.amount}|${rec.direction || 'outflow'}|${rec.transactionType || ''}|${rec.installmentNumber || ''}`;
  if (type === 'gold') return `${rec.date}|${rec.karat}|${rec.unit}`;
  if (type === 'fx') return `${rec.date}|${rec.base}|${rec.quote}`;
  if (type === 'cpi') return `${rec.effectiveDate}|${rec.country}`;
  if (type === 'investment') return `inv|${(rec.name || '').toLowerCase().trim()}`;
  if (type === 'custombenchmark') return `cb|${(rec.name || '').toLowerCase().trim()}|${rec.date}`;
  return '';
}

export function existingKeySet(type, existing, ctx = {}) {
  const map = new Map(); // key -> existingId
  for (const r of existing) {
    map.set(dupKey(type, r, ctx), r.id);
  }
  return map;
}

// Status constants
export const STATUS = { NEW: 'new', DUPLICATE: 'duplicate', CONFLICT: 'conflict', ERROR: 'error' };

// Prepare all rows: build + validate + duplicate/conflict status.
// Returns array of prepared rows (no per-row action yet — UI layers that on).
export function prepareRows(type, dataRows, map, opts, existing, ctx = {}) {
  const cfg = IMPORT_TYPES[type];
  const existingMap = existingKeySet(type, existing, ctx);
  const batchKeys = new Map(); // key -> first rowIndex
  const out = [];
  dataRows.forEach((row, i) => {
    const record = buildRecord(type, row, map, opts);
    const built = type === 'cashflow' && ctx.investmentId
      ? { ...record, investmentId: ctx.investmentId }
      : record;
    const { errors, warnings } = validateImportRow(type, built, ctx);
    const key = dupKey(type, built, ctx);
    let status = STATUS.NEW;
    let existingId = null;
    if (errors.length) {
      status = STATUS.ERROR;
    } else if (existingMap.has(key)) {
      status = STATUS.CONFLICT;
      existingId = existingMap.get(key);
    } else if (batchKeys.has(key)) {
      status = STATUS.DUPLICATE;
    } else {
      batchKeys.set(key, i);
    }
    out.push({ rowIndex: i, raw: row, built, errors, warnings, status, existingId, key });
  });
  return out;
}

// Compute planned action per row given a default conflict action + per-row overrides.
// conflictAction: 'skip' | 'replace' | 'keep'
export function plannedAction(prepared, conflictAction, overrides = {}) {
  if (prepared.status === STATUS.ERROR) return 'skip-reject';
  if (prepared.status === STATUS.DUPLICATE) return overrides[prepared.rowIndex] || 'skip';
  if (prepared.status === STATUS.CONFLICT) return overrides[prepared.rowIndex] || conflictAction;
  return 'insert';
}

// Build the ops array for the atomic store import, given prepared rows + actions.
export function buildOps(type, preparedRows, actions) {
  const ops = [];
  preparedRows.forEach((p, i) => {
    const action = actions[i];
    if (!action || action === 'skip' || action === 'skip-reject') return;
    if (action === 'insert' || action === 'keep') {
      ops.push({ action: 'insert', record: cleanRecord(type, p.built) });
    } else if (action === 'replace') {
      if (p.existingId) ops.push({ action: 'replace', existingId: p.existingId, record: cleanRecord(type, p.built) });
      else ops.push({ action: 'insert', record: cleanRecord(type, p.built) }); // e.g. custom-benchmark merge
    }
  });
  return ops;
}

// Strip internal debug fields before persisting.
function cleanRecord(type, built) {
  const out = { ...built };
  for (const k of Object.keys(out)) if (k.startsWith('_')) delete out[k];
  return out;
}

// Summary counts for a set of prepared rows + actions.
export function summarize(preparedRows, actions) {
  const s = { total: preparedRows.length, ready: 0, new: 0, duplicates: 0, conflicts: 0, toInsert: 0, toReplace: 0, toSkip: 0, toReject: 0, warnings: 0, errors: 0 };
  preparedRows.forEach((p, i) => {
    const action = actions[i];
    if (p.warnings.length) s.warnings++;
    if (p.errors.length) s.errors++;
    if (p.status === STATUS.NEW) s.new++;
    if (p.status === STATUS.DUPLICATE) s.duplicates++;
    if (p.status === STATUS.CONFLICT) s.conflicts++;
    if (action === 'insert' || action === 'keep') { s.toInsert++; s.ready++; }
    if (action === 'replace') { s.toReplace++; s.ready++; }
    if (action === 'skip') s.toSkip++;
    if (action === 'skip-reject') s.toReject++;
  });
  return s;
}
