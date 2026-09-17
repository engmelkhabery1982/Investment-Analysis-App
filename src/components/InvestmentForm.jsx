import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { validateInvestment } from '@/lib/validation';
import { addInvestment, updateInvestment } from '@/lib/store';

const CURRENCIES = ['EGP', 'USD', 'SAR', 'EUR', 'AED', 'GBP'];
const PROPERTY_TYPES = ['Apartment', 'Villa', 'Land', 'Shop', 'Office', 'Other'];

const empty = {
  name: '', projectName: '', developer: '', description: '', propertyType: 'Apartment',
  unitNumber: '', location: '', purchaseCurrency: 'EGP', contractDate: '',
  analysisStartDate: '', valuationDate: '', originalContractValue: '',
  currentValuation: '', currentValuationCurrency: 'EGP', notes: '',
};

export default function InvestmentForm({ open, onClose, investment = null }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (open) {
      setForm(investment ? { ...empty, ...investment } : empty);
      setErrors([]);
    }
  }, [open, investment]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    const errs = validateInvestment(form);
    if (errs.length) { setErrors(errs); return; }
    if (investment) updateInvestment(investment.id, form);
    else addInvestment(form);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{investment ? 'Edit investment' : 'Create investment'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <Field label="Investment name *" full>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. New Cairo Apartment" />
          </Field>
          <Field label="Project name"><Input value={form.projectName} onChange={e => set('projectName', e.target.value)} /></Field>
          <Field label="Developer / seller"><Input value={form.developer} onChange={e => set('developer', e.target.value)} /></Field>
          <Field label="Property type">
            <Select value={form.propertyType} onValueChange={v => set('propertyType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Unit number"><Input value={form.unitNumber} onChange={e => set('unitNumber', e.target.value)} /></Field>
          <Field label="Location"><Input value={form.location} onChange={e => set('location', e.target.value)} /></Field>
          <Field label="Purchase currency *">
            <Select value={form.purchaseCurrency} onValueChange={v => set('purchaseCurrency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Current valuation currency">
            <Select value={form.currentValuationCurrency} onValueChange={v => set('currentValuationCurrency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Contract / purchase date"><Input type="date" value={form.contractDate} onChange={e => set('contractDate', e.target.value)} /></Field>
          <Field label="Analysis start date"><Input type="date" value={form.analysisStartDate} onChange={e => set('analysisStartDate', e.target.value)} /></Field>
          <Field label="Valuation date *"><Input type="date" value={form.valuationDate} onChange={e => set('valuationDate', e.target.value)} /></Field>
          <Field label="Current property valuation *"><Input type="number" step="any" value={form.currentValuation} onChange={e => set('currentValuation', e.target.value)} placeholder="e.g. 1100000" /></Field>
          <Field label="Original contract value (optional)"><Input type="number" step="any" value={form.originalContractValue} onChange={e => set('originalContractValue', e.target.value)} /></Field>
          <Field label="Property description" full><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></Field>
          <Field label="Notes" full><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></Field>
        </div>
        {errors.length > 0 && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 space-y-1">
            {errors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{investment ? 'Save changes' : 'Create investment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2 space-y-1.5' : 'space-y-1.5'}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}