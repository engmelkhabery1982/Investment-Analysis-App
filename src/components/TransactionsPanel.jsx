import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Copy, Download, Upload, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCashFlows } from '@/lib/hooks';
import { deleteCashFlow, duplicateCashFlow } from '@/lib/store';
import { fmtMoney } from '@/lib/format';
import * as D from '@/lib/decimal';
import { downloadCSV } from '@/lib/csv';
import CashFlowForm from '@/components/CashFlowForm';
import { eligibleCashFlows } from '@/lib/finance';

const STATUS_COLORS = { paid: 'secondary', future: 'outline', cancelled: 'outline', refunded: 'outline' };
const DIR_COLORS = { outflow: 'outline', inflow: 'secondary' };

export default function TransactionsPanel({ investment }) {
  const cashFlows = useCashFlows(investment.id);
  const [cfOpen, setCfOpen] = useState(false);
  const [editingCf, setEditingCf] = useState(null);
  const [toDeleteCf, setToDeleteCf] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    return cashFlows
      .filter(c => statusFilter === 'all' || c.status === statusFilter)
      .filter(c => !search || (c.description || '').toLowerCase().includes(search.toLowerCase()) || (c.notes || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [cashFlows, search, statusFilter]);

  const eligible = eligibleCashFlows(cashFlows, investment.valuationDate);
  const totalPaid = eligible.reduce((acc, c) => D.add(acc, c.amount), 0n);

  function exportCsv() {
    const headers = ['date', 'amount', 'direction', 'transactionType', 'currency', 'description', 'installmentNumber', 'paymentType', 'status', 'notes'];
    const rows = [headers, ...cashFlows.map(c => headers.map(h => c[h] ?? ''))];
    downloadCSV(`${(investment.name || 'investment').replace(/\s+/g, '_')}_transactions.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => { setEditingCf(null); setCfOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add transaction</Button>
        <Button variant="outline" asChild><Link to={`/data-import?type=cashflow&investmentId=${investment.id}`}><Upload className="w-4 h-4 mr-2" />Import</Link></Button>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border rounded-md text-sm px-2 py-2 bg-background" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="future">Future</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">Total eligible paid: <span className="font-medium text-foreground">{fmtMoney(totalPaid, 2, investment.baseCurrency || investment.purchaseCurrency)}</span> ({eligible.length} transactions) • Valuation date: {investment.valuationDate}</div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Direction</TableHead><TableHead>Amount</TableHead><TableHead>Currency</TableHead>
              <TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No transactions. Add one or import a CSV.</TableCell></TableRow>}
            {filtered.map(c => {
              const afterValuation = investment.valuationDate && c.status === 'paid' && !(c.date < investment.valuationDate);
              return (
                <TableRow key={c.id} className={afterValuation ? 'bg-amber-50' : ''}>
                  <TableCell className="whitespace-nowrap">{c.date}</TableCell>
                  <TableCell><Badge variant={DIR_COLORS[c.direction] || 'outline'} className="capitalize">{c.direction || 'outflow'}</Badge></TableCell>
                  <TableCell>{fmtMoney(c.amount, 2, c.currency)}</TableCell>
                  <TableCell>{c.currency}</TableCell>
                  <TableCell>{c.transactionType || c.paymentType || '—'}</TableCell>
                  <TableCell>{c.description || '—'}</TableCell>
                  <TableCell><Badge variant={STATUS_COLORS[c.status] || 'secondary'} className="capitalize">{c.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{c.notes || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingCf(c); setCfOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => duplicateCashFlow(c.id)}><Copy className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDeleteCf(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {afterValuationNote(investment, filtered)}
      <CashFlowForm open={cfOpen} onClose={() => setCfOpen(false)} investmentId={investment.id} valuationDate={investment.valuationDate} cashFlow={editingCf} />

      <AlertDialog open={!!toDeleteCf} onOpenChange={o => !o && setToDeleteCf(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>This transaction record will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => { deleteCashFlow(toDeleteCf.id); setToDeleteCf(null); }}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function afterValuationNote(investment, filtered) {
  const bad = filtered.filter(c => c.status === 'paid' && investment.valuationDate && !(c.date < investment.valuationDate));
  if (bad.length === 0) return null;
  return <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">{bad.length} paid transaction(s) are on or after the valuation date ({investment.valuationDate}) and are excluded from valuation calculations.</div>;
}