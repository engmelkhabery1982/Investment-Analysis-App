import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { validateFx, findDuplicates } from '@/lib/validation';
import { addFx, updateFx, getState } from '@/lib/store';

const BASES = ['USD', 'SAR', 'EUR', 'AED', 'GBP'];
const QUOTES = ['EGP'];
const QUALITIES = ['Verified', 'User Entered', 'Imported', 'Estimated'];

const empty = { date: '', base: 'USD', quote: 'EGP', bid: '', ask: '', source: '', notes: '', quality: 'User Entered' };

export default function FxForm({ open, onClose, record = null }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (open) { setForm(record ? { ...empty, ...record } : empty); setErrors([]); }
  }, [open, record]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    const errs = validateFx(form);
    const dup = findDuplicates(getState().fx.filter(f => f.id !== (record?.id || '')), f => `${f.date}|${f.base}|${f.quote}`)
      .find(f => f.date === form.date && f.base === form.base && f.quote === form.quote);
    if (dup) errs.push('A record already exists for this date + pair. Edit it instead.');
    if (errs.length) { setErrors(errs); return; }
    const payload = { ...form, bid: Number(form.bid), ask: Number(form.ask) };
    if (record) updateFx(record.id, payload); else addFx(payload);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{record ? 'Edit FX rate' : 'Add FX rate'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <Field label="Date *"><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Data quality">
            <Select value={form.quality} onValueChange={v => set('quality', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{QUALITIES.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Base currency (foreign) *">
            <Select value={form.base} onValueChange={v => set('base', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BASES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Quote currency *">
            <Select value={form.quote} onValueChange={v => set('quote', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{QUOTES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={`Ask (${form.base}/${form.quote}) *`}><Input type="number" step="any" value={form.ask} onChange={e => set('ask', e.target.value)} /></Field>
          <Field label={`Bid (${form.base}/${form.quote}) *`}><Input type="number" step="any" value={form.bid} onChange={e => set('bid', e.target.value)} /></Field>
          <Field label="Source" full><Input value={form.source} onChange={e => set('source', e.target.value)} /></Field>
          <Field label="Notes" full><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Ask = EGP paid to buy 1 {form.base}. Bid = EGP received when selling 1 {form.base}.</p>
        {errors.length > 0 && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 space-y-1">{errors.map((e, i) => <div key={i}>• {e}</div>)}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{record ? 'Save' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }) {
  return <div className={full ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>{children}
  </div>;
}