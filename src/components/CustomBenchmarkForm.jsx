import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { CURRENCIES } from '@/lib/model';

const empty = () => ({ name: '', currency: 'EGP', data: [] });

export default function CustomBenchmarkForm({ open, onClose, benchmark }) {
  const [form, setForm] = useState(empty());
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(benchmark ? { name: benchmark.name || '', currency: benchmark.currency || 'EGP', data: (benchmark.data || []).map(r => ({ ...r })) } : empty());
      setError('');
    }
  }, [open, benchmark]);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function addRow() { setForm(f => ({ ...f, data: [...f.data, { date: '', value: '' }] })); }
  function updateRow(i, k, v) { setForm(f => ({ ...f, data: f.data.map((r, idx) => idx === i ? { ...r, [k]: v } : r) })); }
  function removeRow(i) { setForm(f => ({ ...f, data: f.data.filter((_, idx) => idx !== i) })); }

  function submit() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    const data = form.data
      .filter(r => r.date && r.value !== '')
      .map(r => ({ date: r.date, value: Number(r.value) }))
      .filter(r => r.date && Number.isFinite(r.value));
    if (data.length < 2) { setError('At least two valid data points (date + value) are required.'); return; }
    const payload = { name: form.name.trim(), currency: form.currency, data };
    onClose(payload);
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{benchmark ? 'Edit custom benchmark' : 'New custom benchmark'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. EGX30 Index" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setField('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Price / index series</Label>
              <Button variant="outline" size="sm" onClick={addRow}><Plus className="w-4 h-4 mr-1" />Add row</Button>
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 p-2 text-xs text-muted-foreground border-b">
                <div>Date</div><div>Value / Index</div><div />
              </div>
              {form.data.length === 0 && <div className="p-3 text-sm text-muted-foreground text-center">No rows yet. Add at least two.</div>}
              {form.data.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 p-2 border-b last:border-b-0 items-center">
                  <Input type="date" value={r.date} onChange={e => updateRow(i, 'date', e.target.value)} />
                  <Input type="number" step="any" value={r.value} onChange={e => updateRow(i, 'value', e.target.value)} placeholder="value" />
                  <Button variant="ghost" size="icon" onClick={() => removeRow(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(null)}>Cancel</Button>
          <Button onClick={submit}>{benchmark ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}