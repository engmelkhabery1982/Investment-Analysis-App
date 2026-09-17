import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { INVESTMENT_STATUSES, COMPOUNDING } from '@/lib/model';

// Default override shape for a new scenario (all null = use actual data).
const emptyOverrides = () => ({
  currentValuation: '', valuationDate: '', status: '',
  fixedReturnRate: '', fixedReturnCompounding: 'annual',
  exitFees: '', customBenchmarkIds: [],
});

export default function ScenarioForm({ open, onClose, scenario, investment, customBenchmarks }) {
  const [name, setName] = useState('');
  const [ov, setOv] = useState(emptyOverrides());
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(scenario?.name || '');
      setOv(scenario?.overrides ? { ...emptyOverrides(), ...scenario.overrides } : emptyOverrides());
      setError('');
    }
  }, [open, scenario]);

  function set(k, v) { setOv(o => ({ ...o, [k]: v })); }
  function toggleBenchmark(id, checked) {
    setOv(o => ({ ...o, customBenchmarkIds: checked ? [...(o.customBenchmarkIds || []), id] : (o.customBenchmarkIds || []).filter(x => x !== id) }));
  }

  function submit() {
    if (!name.trim()) { setError('Scenario name is required.'); return; }
    // Only carry overrides that are actually set.
    const overrides = {};
    if (ov.currentValuation !== '') overrides.currentValuation = Number(ov.currentValuation);
    if (ov.valuationDate) overrides.valuationDate = ov.valuationDate;
    if (ov.status) overrides.status = ov.status;
    if (ov.fixedReturnRate !== '') overrides.fixedReturnRate = Number(ov.fixedReturnRate);
    if (ov.fixedReturnCompounding) overrides.fixedReturnCompounding = ov.fixedReturnCompounding;
    if (ov.exitFees !== '') overrides.exitFees = Number(ov.exitFees);
    if ((ov.customBenchmarkIds || []).length) overrides.customBenchmarkIds = ov.customBenchmarkIds;
    onClose({ name: name.trim(), overrides });
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{scenario ? 'Edit scenario' : 'New scenario'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Scenario name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gold at 7000" />
          </div>
          <p className="text-xs text-muted-foreground">Overrides are optional. Leave a field blank to use the investment's actual data. The original data is never modified.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Alternative current / terminal value</Label>
              <Input type="number" step="any" value={ov.currentValuation} onChange={e => set('currentValuation', e.target.value)} placeholder={String(investment?.currentValuation ?? '')} />
            </div>
            <div className="space-y-1.5">
              <Label>Alternative valuation date</Label>
              <Input type="date" value={ov.valuationDate} onChange={e => set('valuationDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={ov.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue placeholder={investment?.status || 'Actual'} /></SelectTrigger>
                <SelectContent>{INVESTMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Exit fees (reduce terminal value)</Label>
              <Input type="number" step="any" value={ov.exitFees} onChange={e => set('exitFees', e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Fixed-return rate (annual)</Label>
              <Input type="number" step="any" value={ov.fixedReturnRate} onChange={e => set('fixedReturnRate', e.target.value)} placeholder="e.g. 0.12" />
            </div>
            <div className="space-y-1.5">
              <Label>Fixed-return compounding</Label>
              <Select value={ov.fixedReturnCompounding} onValueChange={v => set('fixedReturnCompounding', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMPOUNDING.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {customBenchmarks && customBenchmarks.length > 0 && (
            <div className="space-y-1.5">
              <Label>Active custom benchmarks</Label>
              <p className="text-xs text-muted-foreground">Select which custom benchmarks to include in this scenario. Unchecked ones are excluded.</p>
              <div className="space-y-2">
                {customBenchmarks.map(cb => (
                  <label key={cb.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(ov.customBenchmarkIds || []).includes(cb.id)} onChange={e => toggleBenchmark(cb.id, e.target.checked)} />
                    {cb.name} <span className="text-muted-foreground">({cb.currency})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(null)}>Cancel</Button>
          <Button onClick={submit}>{scenario ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}