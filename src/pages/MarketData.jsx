import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Upload, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useStore } from '@/lib/hooks';
import { deleteGold, deleteFx, deleteCpi } from '@/lib/store';
import { downloadCSV } from '@/lib/csv';
import { fmtNumber, fmtDate } from '@/lib/format';
import GoldForm from '@/components/GoldForm';
import FxForm from '@/components/FxForm';
import CpiForm from '@/components/CpiForm';
import ImportDialog from '@/components/ImportDialog';

export default function MarketData() {
  const s = useStore();
  const [tab, setTab] = useState('gold');

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-heading tracking-tight">Market data</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="gold">Gold ({s.gold.length})</TabsTrigger>
          <TabsTrigger value="fx">FX ({s.fx.length})</TabsTrigger>
          <TabsTrigger value="cpi">Inflation / CPI ({s.cpi.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="gold"><GoldPanel /></TabsContent>
        <TabsContent value="fx"><FxPanel /></TabsContent>
        <TabsContent value="cpi"><CpiPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function GoldPanel() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [karatFilter, setKaratFilter] = useState('all');

  const rows = useMemo(() => s.gold
    .filter(g => karatFilter === 'all' || g.karat === karatFilter)
    .filter(g => !search || g.date.includes(search) || (g.source || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.date < b.date ? -1 : 1)), [s.gold, search, karatFilter]);

  function exportCsv() {
    const headers = ['date', 'karat', 'unit', 'ask', 'bid', 'source', 'sourceDate', 'notes', 'quality'];
    downloadCSV('gold_prices.csv', [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add gold price</Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-2" />Import CSV</Button>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
        <div className="ml-auto flex gap-2">
          <select className="border rounded-md text-sm px-2 bg-background" value={karatFilter} onChange={e => setKaratFilter(e.target.value)}>
            <option value="all">All karats</option>
            {[...new Set(s.gold.map(g => g.karat))].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 w-44" placeholder="Search date/source" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>
      <DataTable headers={['Date', 'Karat', 'Unit', 'Ask (EGP)', 'Bid (EGP)', 'Source', 'Quality', 'Notes', '']}>
        {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No gold data.</TableCell></TableRow>}
        {rows.map(g => (
          <TableRow key={g.id} className={Number(g.bid) > Number(g.ask) ? 'bg-amber-50' : ''}>
            <TableCell className="whitespace-nowrap">{fmtDate(g.date)}</TableCell>
            <TableCell>{g.karat}</TableCell>
            <TableCell>{g.unit}</TableCell>
            <TableCell>{fmtNumber(g.ask, 2)}</TableCell>
            <TableCell>{fmtNumber(g.bid, 2)}</TableCell>
            <TableCell className="text-xs">{g.source || '—'}</TableCell>
            <TableCell><Badge variant="outline">{g.quality || '—'}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{g.notes || '—'}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(g); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setToDelete(g)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
      <GoldForm open={open} onClose={() => setOpen(false)} record={editing} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} type="gold" />
      <DeleteDialog toDelete={toDelete} setToDelete={setToDelete} onDelete={() => { deleteGold(toDelete.id); setToDelete(null); }} label="gold price" />
    </div>
  );
}

function FxPanel() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pairFilter, setPairFilter] = useState('all');

  const rows = useMemo(() => s.fx
    .filter(f => pairFilter === 'all' || `${f.base}/${f.quote}` === pairFilter)
    .filter(f => !search || f.date.includes(search) || f.base.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.date < b.date ? -1 : 1)), [s.fx, search, pairFilter]);

  const pairs = [...new Set(s.fx.map(f => `${f.base}/${f.quote}`))];

  function exportCsv() {
    const headers = ['date', 'base', 'quote', 'bid', 'ask', 'source', 'notes', 'quality'];
    downloadCSV('fx_rates.csv', [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add FX rate</Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-2" />Import CSV</Button>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
        <div className="ml-auto flex gap-2">
          <select className="border rounded-md text-sm px-2 bg-background" value={pairFilter} onChange={e => setPairFilter(e.target.value)}>
            <option value="all">All pairs</option>
            {pairs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 w-44" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>
      <DataTable headers={['Date', 'Pair', 'Bid', 'Ask', 'Source', 'Quality', 'Notes', '']}>
        {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No FX data.</TableCell></TableRow>}
        {rows.map(f => (
          <TableRow key={f.id} className={Number(f.bid) > Number(f.ask) ? 'bg-amber-50' : ''}>
            <TableCell className="whitespace-nowrap">{fmtDate(f.date)}</TableCell>
            <TableCell>{f.base}/{f.quote}</TableCell>
            <TableCell>{fmtNumber(f.bid, 4)}</TableCell>
            <TableCell>{fmtNumber(f.ask, 4)}</TableCell>
            <TableCell className="text-xs">{f.source || '—'}</TableCell>
            <TableCell><Badge variant="outline">{f.quality || '—'}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{f.notes || '—'}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(f); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setToDelete(f)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
      <FxForm open={open} onClose={() => setOpen(false)} record={editing} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} type="fx" />
      <DeleteDialog toDelete={toDelete} setToDelete={setToDelete} onDelete={() => { deleteFx(toDelete.id); setToDelete(null); }} label="FX rate" />
    </div>
  );
}

function CpiPanel() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => s.cpi
    .filter(c => !search || c.effectiveDate.includes(search) || (c.country || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1)), [s.cpi, search]);

  function exportCsv() {
    const headers = ['effectiveDate', 'cpiValue', 'frequency', 'country', 'source', 'notes'];
    downloadCSV('cpi.csv', [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add CPI record</Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-2" />Import CSV</Button>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
        <div className="ml-auto relative">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-44" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <DataTable headers={['Effective date', 'CPI value', 'Frequency', 'Country', 'Source', 'Notes', '']}>
        {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No CPI data.</TableCell></TableRow>}
        {rows.map(c => (
          <TableRow key={c.id}>
            <TableCell className="whitespace-nowrap">{fmtDate(c.effectiveDate)}</TableCell>
            <TableCell>{fmtNumber(c.cpiValue, 2)}</TableCell>
            <TableCell className="capitalize">{c.frequency}</TableCell>
            <TableCell>{c.country}</TableCell>
            <TableCell className="text-xs">{c.source || '—'}</TableCell>
            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{c.notes || '—'}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
      <CpiForm open={open} onClose={() => setOpen(false)} record={editing} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} type="cpi" />
      <DeleteDialog toDelete={toDelete} setToDelete={setToDelete} onDelete={() => { deleteCpi(toDelete.id); setToDelete(null); }} label="CPI record" />
    </div>
  );
}

function DataTable({ headers, children }) {
  return <div className="border rounded-md overflow-x-auto">
    <Table>
      <TableHeader><TableRow>{headers.map((h, i) => <TableHead key={i} className={i === headers.length - 1 ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  </div>;
}

function DeleteDialog({ toDelete, setToDelete, onDelete, label }) {
  return (
    <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>This record will be permanently deleted.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}