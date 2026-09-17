import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { validateGold, findDuplicates } from '@/lib/validation';
import { addGold, updateGold, getState } from '@/lib/store';

const KARATS = ['21K', '24K', '18K', '22K'];
const QUALITIES = ['Verified', 'User Entered', 'Imported', 'Estimated'];

const empty = { date: '', karat: '21K', unit: 'gram', ask: '', bid: '', source: '', sourceDate: '', notes: '', quality: 'User Entered' };

export default function GoldForm({ open, onClose, record = null }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (open) { setForm(record ? { ...empty, ...record } : empty); setErrors([]); }
  }, [open, record]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    const errs = validateGold(form);
    const dup = findDuplicates(getState().gold.filter(g => g.id !== (record?.id || '')), g => `${g.date}|${g.karat}|${g.unit}`)
      .find(g => g.date === form.date && g.karat === form.karat && g.unit === form.unit);
    if (dup) errs.push('A record already exists for this date + gold type. Edit it instead.');
    if (errs.length) { setErrors(errs); return; }
    const payload = { ...form, ask: Number(form.ask), bid: Number(form.bid) };
    if (record) updateGold(record.id, payload); else addGold(payload);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{record ? 'Edit gold price' : 'Add gold price'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <Field label="Date *"><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Gold type *">
            <Select value={form.karat} onValueChange={v => set('karat', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KARATS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Unit"><Input value={form.unit} onChange={e => set('unit', e.target.value)} /></Field>
          <Field label="Data quality">
            <Select value={form.quality} onValueChange={v => set('quality', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{QUALITIES.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Ask price (EGP) *"><Input type="number" step="any" value={form.ask} onChange={e => set('ask', e.target.value)} /></Field>
          <Field label="Bid price (EGP) *"><Input type="number" step="any" value={form.bid} onChange={e => set('bid', e.target.value)} /></Field>
          <Field label="Source"><Input value={form.source} onChange={e => set('source', e.target.value)} /></Field>
          <Field label="Source date"><Input type="date" value={form.sourceDate} onChange={e => set('sourceDate', e.target.value)} /></Field>
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