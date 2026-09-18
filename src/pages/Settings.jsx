import { useStore } from '@/lib/hooks';
import { updateSettings, clearAll, resetToSample, removeDemo, addCustomBenchmark, updateCustomBenchmark, deleteCustomBenchmark, exportBackupString, restoreBackup } from '@/lib/store';
import { validateBackup } from '@/lib/backup';
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
import { useState, useRef } from 'react';

const CURRENCIES = ['USD', 'SAR', 'EUR'];
const POLICIES = [{ value: 'previous', label: 'Previous (on or before)' }, { value: 'nearest', label: 'Nearest (tie → previous)' }, { value: 'exact', label: 'Exact only' }];
const GOLD_TYPES = ['21K', '24K', '18K', '22K'];

export default function Settings() {
  const s = useStore();
  const set = updateSettings;
  const [confirm, setConfirm] = useState(null);
  const [cbOpen, setCbOpen] = useState(false);
  const [editingCb, setEditingCb] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreError, setRestoreError] = useState('');
  const [restoreParsed, setRestoreParsed] = useState(null);
  const fileRef = useRef(null);

  function exportBackup() {
    const blob = new Blob([exportBackupString()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `investment-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function onRestoreFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setRestoreError(''); setRestorePreview(null); setRestoreParsed(null);
    file.text().then(text => {
      let parsed;
      try { parsed = JSON.parse(text); } catch (err) { setRestoreError('Backup file is not valid JSON.'); return; }
      const v = validateBackup(parsed);
      if (!v.ok) { setRestoreError(v.error); return; }
      setRestoreParsed(parsed); setRestorePreview(v.preview);
    }).catch(() => setRestoreError('Could not read the file.'));
    e.target.value = '';
  }
  function confirmRestore() {
    if (!restoreParsed) return;
    const res = restoreBackup(restoreParsed);
    if (!res.ok) { setRestoreError(res.error); return; }
    setRestorePreview(null); setRestoreParsed(null);
    setConfirm('restored');
  }

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
        <CardHeader><CardTitle className="text-base">Backup & Restore</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Export a versioned JSON backup of all investments, transactions, market data, custom benchmarks, scenarios and settings. Restore replaces all local data atomically — a failed or corrupt restore leaves your current data untouched.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportBackup}>Export full backup</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>Import / restore backup</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onRestoreFile} />
          </div>
          {restoreError && <p className="text-sm text-destructive">{restoreError}</p>}
          {restorePreview && (
            <div className="border rounded-md p-3 text-sm space-y-2">
              <div className="font-medium">Backup preview</div>
              <div className="text-xs text-muted-foreground">Created: {restorePreview.createdAt || '—'} • Version {restorePreview.version}</div>
              <ul className="text-xs grid grid-cols-2 gap-x-4 gap-y-0.5">
                <li>Investments: {restorePreview.investments}</li>
                <li>Transactions: {restorePreview.cashflows}</li>
                <li>Gold: {restorePreview.gold}</li>
                <li>FX: {restorePreview.fx}</li>
                <li>CPI: {restorePreview.cpi}</li>
                <li>Custom benchmarks: {restorePreview.customBenchmarks}</li>
                <li>Scenarios: {restorePreview.scenarios}</li>
                {restorePreview.orphanTransactions > 0 && <li className="text-amber-600 col-span-2">Orphan transactions (no matching investment): {restorePreview.orphanTransactions}</li>}
              </ul>
              <p className="text-xs text-destructive">This will replace ALL current data. This cannot be undone.</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={confirmRestore}>Replace all data with this backup</Button>
                <Button variant="ghost" onClick={() => { setRestorePreview(null); setRestoreParsed(null); }}>Cancel</Button>
              </div>
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
            <AlertDialogTitle>{confirm === 'clear' ? 'Clear all data?' : confirm === 'sample' ? 'Reset to demo data?' : confirm === 'restored' ? 'Backup restored' : 'Remove demo data?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'clear' ? 'All investments, payments and market data will be deleted.' : confirm === 'sample' ? 'Your current data will be replaced with the demo dataset.' : confirm === 'restored' ? 'Your data has been replaced with the backup contents.' : 'All records marked DEMO will be removed; your real data stays.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {confirm !== 'restored' && <AlertDialogCancel>Cancel</AlertDialogCancel>}
            <AlertDialogAction onClick={() => {
              if (confirm === 'clear') clearAll();
              else if (confirm === 'sample') resetToSample();
              else if (confirm === 'demo') removeDemo();
              setConfirm(null);
            }}>OK</AlertDialogAction>
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