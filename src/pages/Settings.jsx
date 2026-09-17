import { useStore } from '@/lib/hooks';
import { updateSettings, clearAll, resetToSample, removeDemo, addCustomBenchmark, updateCustomBenchmark, deleteCustomBenchmark } from '@/lib/store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { COMPOUNDING } from '@/lib/model';
import CustomBenchmarkForm from '@/components/CustomBenchmarkForm';
import { useState } from 'react';

const CURRENCIES = ['USD', 'SAR', 'EUR'];
const POLICIES = [{ value: 'previous', label: 'Previous (on or before)' }, { value: 'nearest', label: 'Nearest (tie → previous)' }, { value: 'exact', label: 'Exact only' }];
const GOLD_TYPES = ['21K', '24K', '18K', '22K'];

export default function Settings() {
  const s = useStore();
  const set = updateSettings;
  const [confirm, setConfirm] = useState(null);
  const [cbOpen, setCbOpen] = useState(false);
  const [editingCb, setEditingCb] = useState(null);

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-heading tracking-tight">Settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Financial defaults</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Row label="Default currency">
            <Select value={s.settings.defaultCurrency} onValueChange={v => set({ defaultCurrency: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{['EGP', 'USD', 'SAR', 'EUR', 'AED', 'GBP'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label="Default gold type">
            <Select value={s.settings.defaultGoldType} onValueChange={v => set({ defaultGoldType: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{GOLD_TYPES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label="Default date policy">
            <Select value={s.settings.defaultDatePolicy} onValueChange={v => set({ defaultDatePolicy: v })}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{POLICIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label="Decimal display precision">
            <Input type="number" min={0} max={6} value={s.settings.displayPrecision} onChange={e => set({ displayPrecision: Number(e.target.value) })} className="w-24" />
          </Row>
          <Row label="XNPV discount rate (optional)">
            <Input type="number" step="any" value={s.settings.xnpvDiscountRate ?? ''} onChange={e => set({ xnpvDiscountRate: e.target.value === '' ? null : Number(e.target.value) })} className="w-32" placeholder="e.g. 0.10" />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Comparison currencies</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {CURRENCIES.map(c => (
              <div key={c} className="flex items-center justify-between">
                <Label>{c}/EGP comparison</Label>
                <Switch checked={s.settings.enabledCurrencies.includes(c)} onCheckedChange={checked => {
                  const next = checked ? [...s.settings.enabledCurrencies, c] : s.settings.enabledCurrencies.filter(x => x !== c);
                  set({ enabledCurrencies: next });
                }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Fixed-return benchmark</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">A fixed-return benchmark grows each outflow at this rate to the valuation date. Leave empty to disable it.</p>
          <Row label="Annual rate">
            <Input type="number" step="any" value={s.settings.fixedReturnRate ?? ''} onChange={e => set({ fixedReturnRate: e.target.value === '' ? '' : Number(e.target.value) })} className="w-32" placeholder="e.g. 0.12" />
          </Row>
          <Row label="Compounding">
            <Select value={s.settings.fixedReturnCompounding || 'annual'} onValueChange={v => set({ fixedReturnCompounding: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{COMPOUNDING.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Custom benchmarks</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { setEditingCb(null); setCbOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add benchmark</Button>
          </div>
        </CardHeader>
        <CardContent>
          {(s.customBenchmarks || []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No custom benchmarks. Add a price/index series to compare against your investments.</div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Currency</TableHead><TableHead>Data points</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {s.customBenchmarks.map(cb => (
                    <TableRow key={cb.id}>
                      <TableCell className="font-medium">{cb.name}</TableCell>
                      <TableCell><Badge variant="outline">{cb.currency}</Badge></TableCell>
                      <TableCell>{(cb.data || []).length}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCb(cb); setCbOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteCustomBenchmark(cb.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Data management</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirm('demo')}>Remove demo data</Button>
            <Button variant="outline" onClick={() => setConfirm('sample')}>Reset to demo data</Button>
            <Button variant="destructive" onClick={() => setConfirm('clear')}>Clear all data</Button>
          </div>
          <p className="text-xs text-muted-foreground">All data is stored locally in your browser. Clearing data cannot be undone.</p>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'clear' ? 'Clear all data?' : confirm === 'sample' ? 'Reset to demo data?' : 'Remove demo data?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'clear' ? 'All investments, payments and market data will be deleted.' : confirm === 'sample' ? 'Your current data will be replaced with the demo dataset.' : 'All records marked DEMO will be removed; your real data stays.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirm === 'clear') clearAll();
              else if (confirm === 'sample') resetToSample();
              else if (confirm === 'demo') removeDemo();
              setConfirm(null);
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CustomBenchmarkForm open={cbOpen} onClose={(payload) => {
        if (!payload) { setCbOpen(false); setEditingCb(null); return; }
        if (editingCb) updateCustomBenchmark(editingCb.id, payload);
        else addCustomBenchmark(payload);
        setCbOpen(false); setEditingCb(null);
      }} benchmark={editingCb} />
    </div>
  );
}

function Row({ label, children }) {
  return <div className="flex items-center justify-between"><Label className="text-sm">{label}</Label>{children}</div>;
}