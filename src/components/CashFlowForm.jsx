import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { validateTransaction } from '@/lib/validation';
import { addCashFlow, updateCashFlow } from '@/lib/store';
import { DIRECTIONS, transactionTypesFor, CURRENCIES } from '@/lib/model';

const STATUSES = [
  { value: 'paid', label: 'Paid' },
  { value: 'future', label: 'Future' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

const empty = {
  date: '', amount: '', currency: 'EGP', direction: 'outflow',
  transactionType: 'Installment', description: '', installmentNumber: '',
  quantity: '', unitPrice: '', fees: '', status: 'paid', notes: '',
};

export default function CashFlowForm({ open, onClose, investmentId, valuationDate, cashFlow = null }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (open) {
      const base = cashFlow ? { ...empty, ...cashFlow } : empty;
      // migrate legacy records: ensure direction + transactionType
      base.direction = base.direction || 'outflow';
      base.transactionType = base.transactionType || base.paymentType || 'Installment';
      setForm(base);
      setErrors([]);
    }
  }, [open, cashFlow]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    const errs = validateTransaction(form, valuationDate);
    if (errs.length) { setErrors(errs); return; }
    const payload = {
      ...form,
      amount: Number(form.amount),
      installmentNumber: form.installmentNumber ? Number(form.installmentNumber) : '',
      quantity: form.quantity ? Number(form.quantity) : '',
      unitPrice: form.unitPrice ? Number(form.unitPrice) : '',
      fees: form.fees ? Number(form.fees) : '',
      // keep legacy paymentType in sync for older code paths
      paymentType: form.transactionType,
    };
    if (cashFlow) updateCashFlow(cashFlow.id, payload);
    else addCashFlow({ ...payload, investmentId });
    onClose();
  }

  const typeOptions = transactionTypesFor(form.direction);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{cashFlow ? 'Edit transaction' : 'Add transaction'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <Field label="Date *"><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Amount *"><Input type="number" step="any" value={form.amount} onChange={e => set('amount', e.target.value)} /></Field>
          <Field label="Direction *">
            <Select value={form.direction} onValueChange={v => {
              const newTypes = transactionTypesFor(v);
              setForm(f => ({ ...f, direction: v, transactionType: newTypes.includes(f.transactionType) ? f.transactionType : newTypes[0] }));
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Transaction type">
            <Select value={form.transactionType} onValueChange={v => set('transactionType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{typeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Currency *">
            <Select value={form.currency} onValueChange={v => set('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Quantity (optional)"><Input type="number" step="any" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
          <Field label="Unit price (optional)"><Input type="number" step="any" value={form.unitPrice} onChange={e => set('unitPrice', e.target.value)} /></Field>
          <Field label="Fees (optional)"><Input type="number" step="any" value={form.fees} onChange={e => set('fees', e.target.value)} /></Field>
          <Field label="Installment # (optional)"><Input type="number" value={form.installmentNumber} onChange={e => set('installmentNumber', e.target.value)} /></Field>
          <Field label="Description" full><Input value={form.description} onChange={e => set('description', e.target.value)} /></Field>
          <Field label="Notes" full><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></Field>
        </div>
        {errors.length > 0 && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 space-y-1">
            {errors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{cashFlow ? 'Save' : 'Add transaction'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }) {
  return <div className={full ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>;
}