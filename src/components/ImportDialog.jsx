import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseCSV } from '@/lib/csv';
import { importCashFlows, importGold, importFx, importCpi } from '@/lib/store';
import { validateCashFlow, validateGold, validateFx, validateCpi, findDuplicates } from '@/lib/validation';

const CONFIGS = {
  cashflow: {
    aliases: { date: ['date', 'payment date', 'payment_date'], amount: ['amount', 'value'], currency: ['currency', 'curr'], description: ['description', 'desc'], installmentNumber: ['installmentnumber', 'installment number', 'installment', 'installment_number'], paymentType: ['paymenttype', 'payment type', 'type', 'payment_type'], status: ['status'], notes: ['notes'] },
    defaults: { currency: 'EGP', paymentType: 'Installment', status: 'paid' },
    build: (m) => ({ date: m.date, amount: Number(m.amount), currency: m.currency || 'EGP', description: m.description || '', installmentNumber: m.installmentNumber ? Number(m.installmentNumber) : '', paymentType: m.paymentType || 'Installment', status: (m.status || 'paid').toLowerCase(), notes: m.notes || '' }),
    validate: (r, ctx) => validateCashFlow(r, ctx.valuationDate),
    import: (records, ctx) => importCashFlows(records, ctx.investmentId),
    dupKey: (r) => `${r.date}|${r.amount}|${r.description}`,
  },
  gold: {
    aliases: { date: ['date'], karat: ['karat', 'gold type', 'type'], unit: ['unit'], ask: ['ask', 'ask price'], bid: ['bid', 'bid price'], source: ['source'], notes: ['notes'] },
    defaults: { karat: '21K', unit: 'gram' },
    build: (m) => ({ date: m.date, karat: m.karat || '21K', unit: m.unit || 'gram', ask: Number(m.ask), bid: Number(m.bid), source: m.source || '', notes: m.notes || '', quality: 'Imported' }),
    validate: (r) => validateGold(r),
    import: (records) => importGold(records),
    dupKey: (r) => `${r.date}|${r.karat}|${r.unit}`,
  },
  fx: {
    aliases: { date: ['date'], base: ['base', 'basecurrency', 'from', 'pair'], quote: ['quote', 'quotecurrency', 'to'], bid: ['bid'], ask: ['ask'], source: ['source'], notes: ['notes'] },
    defaults: { base: 'USD', quote: 'EGP' },
    build: (m) => {
      let base = (m.base || 'USD').toUpperCase();
      if (base.includes('/')) { const [b, q] = base.split('/'); base = b; m.quote = m.quote || q; }
      return { date: m.date, base, quote: (m.quote || 'EGP').toUpperCase(), bid: Number(m.bid), ask: Number(m.ask), source: m.source || '', notes: m.notes || '', quality: 'Imported' };
    },
    validate: (r) => validateFx(r),
    import: (records) => importFx(records),
    dupKey: (r) => `${r.date}|${r.base}|${r.quote}`,
  },
  cpi: {
    aliases: { effectiveDate: ['date', 'effectivedate', 'effective date'], cpiValue: ['cpi', 'cpivalue', 'value'], frequency: ['frequency', 'freq'], country: ['country'], source: ['source'], notes: ['notes'] },
    defaults: { frequency: 'monthly', country: 'Egypt' },
    build: (m) => ({ effectiveDate: m.effectiveDate, cpiValue: Number(m.cpiValue), frequency: m.frequency || 'monthly', country: m.country || 'Egypt', source: m.source || '', notes: m.notes || '' }),
    validate: (r) => validateCpi(r),
    import: (records) => importCpi(records),
    dupKey: (r) => `${r.effectiveDate}|${r.country}`,
  },
};

export default function ImportDialog({ open, onClose, type, ctx = {} }) {
  const cfg = CONFIGS[type];
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);

  function handleParse() {
    const rows = parseCSV(text);
    if (rows.length < 2) { setParsed({ headers: [], records: [], errors: ['No data rows found.'] }); return; }
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const map = {};
    for (const [field, aliases] of Object.entries(cfg.aliases)) {
      const idx = aliases.findIndex(a => headers.includes(a.toLowerCase()));
      if (idx >= 0) map[field] = headers.indexOf(aliases[idx].toLowerCase());
    }
    const records = [];
    const errors = [];
    rows.slice(1).forEach((raw, i) => {
      const m = {};
      for (const field of Object.keys(cfg.aliases)) {
        if (map[field] != null) m[field] = (raw[map[field]] || '').trim();
      }
      if (!m.date && !m.effectiveDate) { errors.push(`Row ${i + 2}: missing date`); return; }
      const rec = cfg.build({ ...cfg.defaults, ...m });
      const errs = cfg.validate(rec, ctx);
      if (errs.length) errors.push(`Row ${i + 2}: ${errs.join('; ')}`);
      else records.push(rec);
    });
    // duplicate detection within batch
    const dups = findDuplicates(records, cfg.dupKey);
    setParsed({ headers: Object.keys(cfg.aliases), records, errors, duplicates: dups.length });
  }

  function doImport() {
    if (!parsed || !parsed.records.length) return;
    const n = cfg.import(parsed.records, ctx);
    setText(''); setParsed(null);
    onClose(n);
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setText(reader.result);
    reader.readAsText(f);
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import {type} data (CSV)</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Upload CSV file</Label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="block text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Or paste CSV content</Label>
            <Textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="date,amount,currency,description,installmentNumber,paymentType,status,notes" />
          </div>
          <Button variant="outline" onClick={handleParse} disabled={!text.trim()}>Preview & validate</Button>
          {parsed && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-green-600 font-medium">{parsed.records.length} valid</span>
                {parsed.duplicates > 0 && <span className="text-amber-600 ml-3">{parsed.duplicates} duplicate(s) in batch</span>}
                {parsed.errors.length > 0 && <span className="text-destructive ml-3">{parsed.errors.length} error(s)</span>}
              </div>
              {parsed.errors.length > 0 && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-md p-3 max-h-32 overflow-y-auto space-y-1">
                  {parsed.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
              {parsed.records.length > 0 && (
                <div className="border rounded-md overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>{Object.keys(parsed.records[0]).map(k => <th key={k} className="text-left p-2 font-medium">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {parsed.records.slice(0, 20).map((r, i) => (
                        <tr key={i} className="border-t">{Object.values(r).map((v, j) => <td key={j} className="p-2">{String(v)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setParsed(null); onClose(); }}>Cancel</Button>
          <Button onClick={doImport} disabled={!parsed || !parsed.records.length}>Import {parsed?.records.length || 0} records</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}