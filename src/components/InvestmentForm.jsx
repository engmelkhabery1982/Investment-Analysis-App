import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { validateInvestment } from '@/lib/validation';
import { addInvestment, updateInvestment } from '@/lib/store';
import { INVESTMENT_TYPES, INVESTMENT_TYPE_ORDER, INVESTMENT_STATUSES, CURRENCIES } from '@/lib/model';

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Land', 'Shop', 'Office', 'Other'];
const KARATS = ['24K', '22K', '21K', '18K', '14K'];

const empty = {
  name: '', type: 'real_estate', status: 'Active', baseCurrency: 'EGP',
  // real estate
  projectName: '', developer: '', description: '', propertyType: 'Apartment',
  unitNumber: '', location: '', contractDate: '', analysisStartDate: '', originalContractValue: '',
  // quantity-based
  symbol: '', karat: '21K', unit: 'gram', quantity: '', unitPrice: '', ownershipPct: '',
  maturityDate: '', annualRate: '',
  // common
  purchaseCurrency: 'EGP', valuationDate: '', currentValuation: '',
  currentValuationCurrency: 'EGP', notes: '',
};

export default function InvestmentForm({ open, onClose, investment = null }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (open) {
      setForm({ ...empty, ...(investment || {}) });
      setErrors([]);
    }
  }, [open, investment]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    const data = { ...form, baseCurrency: form.baseCurrency || form.purchaseCurrency || 'EGP' };
    const errs = validateInvestment(data);
    if (errs.length) { setErrors(errs); return; }
    if (investment) updateInvestment(investment.id, data);
    else addInvestment(data);
    onClose();
  }

  const t = INVESTMENT_TYPES[form.type] || INVESTMENT_TYPES.real_estate;

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
          <Field label="Investment type *">
            <Select value={form.type} onValueChange={v => set('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INVESTMENT_TYPE_ORDER.map(k => <SelectItem key={k} value={k}>{INVESTMENT_TYPES[k].label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Status *">
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INVESTMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Base currency *">
            <Select value={form.baseCurrency} onValueChange={v => set('baseCurrency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Valuation currency">
            <Select value={form.currentValuationCurrency} onValueChange={v => set('currentValuationCurrency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Valuation date *"><Input type="date" value={form.valuationDate} onChange={e => set('valuationDate', e.target.value)} /></Field>
          <Field label={`${t.valueLabel} *`}>
            <Input type="number" step="any" value={form.currentValuation} onChange={e => set('currentValuation', e.target.value)} placeholder="e.g. 1100000" />
          </Field>

          {/* Real-estate-specific */}
          {form.type === 'real_estate' && (<>
            <Field label="Project name"><Input value={form.projectName} onChange={e => set('projectName', e.target.value)} /></Field>
            <Field label="Developer / seller"><Input value={form.developer} onChange={e => set('developer', e.target.value)} /></Field>
            <Field label="Property type">
              <Select value={form.propertyType} onValueChange={v => set('propertyType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Unit number"><Input value={form.unitNumber} onChange={e => set('unitNumber', e.target.value)} /></Field>
            <Field label="Location"><Input value={form.location} onChange={e => set('location', e.target.value)} /></Field>
            <Field label="Contract / purchase date"><Input type="date" value={form.contractDate} onChange={e => set('contractDate', e.target.value)} /></Field>
            <Field label="Original contract value (optional)"><Input type="number" step="any" value={form.originalContractValue} onChange={e => set('originalContractValue', e.target.value)} /></Field>
          </>)}

          {/* Gold-specific */}
          {form.type === 'gold' && (<>
            <Field label="Karat">
              <Select value={form.karat} onValueChange={v => set('karat', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KARATS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Unit"><Input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="gram" /></Field>
            <Field label="Quantity (optional)"><Input type="number" step="any" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
          </>)}

          {/* Stock / ETF */}
          {(form.type === 'stock' || form.type === 'etf') && (<>
            <Field label="Symbol / Ticker"><Input value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="e.g. AAPL" /></Field>
            <Field label="Quantity (shares/units)"><Input type="number" step="any" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
            <Field label="Unit price (optional)"><Input type="number" step="any" value={form.unitPrice} onChange={e => set('unitPrice', e.target.value)} /></Field>
          </>)}

          {/* Currency */}
          {form.type === 'currency' && (<>
            <Field label="Currency held">
              <Select value={form.baseCurrency} onValueChange={v => set('baseCurrency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Quantity (units)"><Input type="number" step="any" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
          </>)}

          {/* Deposit */}
          {form.type === 'deposit' && (<>
            <Field label="Annual rate (%)"><Input type="number" step="any" value={form.annualRate} onChange={e => set('annualRate', e.target.value)} placeholder="e.g. 12" /></Field>
            <Field label="Maturity date"><Input type="date" value={form.maturityDate} onChange={e => set('maturityDate', e.target.value)} /></Field>
          </>)}

          {/* Business */}
          {form.type === 'business' && (<>
            <Field label="Business name"><Input value={form.projectName} onChange={e => set('projectName', e.target.value)} /></Field>
            <Field label="Ownership %"><Input type="number" step="any" value={form.ownershipPct} onChange={e => set('ownershipPct', e.target.value)} /></Field>
          </>)}

          <Field label="Description" full><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></Field>
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