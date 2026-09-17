import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { validateCpi } from '@/lib/validation';
import { addCpi, updateCpi } from '@/lib/store';

const FREQS = ['monthly', 'quarterly', 'annual'];
const empty = { effectiveDate: '', cpiValue: '', frequency: 'monthly', country: 'Egypt', source: '', notes: '' };

export default function CpiForm({ open, onClose, record = null }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (open) { setForm(record ? { ...empty, ...record } : empty); setErrors([]); }
  }, [open, record]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    const errs = validateCpi(form);
    if (errs.length) { setErrors(errs); return; }
    const payload = { ...form, cpiValue: Number(form.cpiValue) };
    if (record) updateCpi(record.id, payload); else addCpi(payload);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{record ? 'Edit CPI record' : 'Add CPI record'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <Field label="Effective date *"><Input type="date" value={form.effectiveDate} onChange={e => set('effectiveDate', e.target.value)} /></Field>
          <Field label="CPI value *"><Input type="number" step="any" value={form.cpiValue} onChange={e => set('cpiValue', e.target.value)} /></Field>
          <Field label="Frequency">
            <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FREQS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Country"><Input value={form.country} onChange={e => set('country', e.target.value)} /></Field>
          <Field label="Source" full><Input value={form.source} onChange={e => set('source', e.target.value)} /></Field>
          <Field label="Notes" full><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
        </div>
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