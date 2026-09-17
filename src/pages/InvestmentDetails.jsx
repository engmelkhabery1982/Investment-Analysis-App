import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Copy, Download, Upload, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useStore, useCashFlows, useAnalysis } from '@/lib/hooks';
import { deleteCashFlow, duplicateCashFlow, updateInvestment, setSelectedInvestment } from '@/lib/store';
import { fmtMoney } from '@/lib/format';
import * as D from '@/lib/decimal';
import { downloadCSV } from '@/lib/csv';
import CashFlowForm from '@/components/CashFlowForm';
import InvestmentForm from '@/components/InvestmentForm';
import ImportDialog from '@/components/ImportDialog';
import AnalysisTable from '@/components/AnalysisTable';
import DataQualityPanel from '@/components/DataQualityPanel';
import { eligibleCashFlows } from '@/lib/finance';

const STATUS_COLORS = { paid: 'secondary', future: 'outline', cancelled: 'outline', refunded: 'outline' };

export default function InvestmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const s = useStore();
  const investment = s.investments.find(i => i.id === id);
  const cashFlows = useCashFlows(id);
  const analysis = useAnalysis(id);

  const [cfOpen, setCfOpen] = useState(false);
  const [editingCf, setEditingCf] = useState(null);
  const [toDeleteCf, setToDeleteCf] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editInvOpen, setEditInvOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  if (!investment) {
    return <div className="py-10 text-center">
      <p className="text-muted-foreground mb-3">Investment not found.</p>
      <Button asChild><Link to="/investments">Back to investments</Link></Button>
    </div>;
  }

  const filtered = useMemo(() => {
    return cashFlows
      .filter(c => statusFilter === 'all' || c.status === statusFilter)
      .filter(c => !search || (c.description || '').toLowerCase().includes(search.toLowerCase()) || (c.notes || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [cashFlows, search, statusFilter]);

  const eligible = eligibleCashFlows(cashFlows, investment.valuationDate);
  const totalPaid = eligible.reduce((acc, c) => D.add(acc, c.amount), 0n);

  function exportCsv() {
    const headers = ['date', 'amount', 'currency', 'description', 'installmentNumber', 'paymentType', 'status', 'notes'];
    const rows = [headers, ...cashFlows.map(c => headers.map(h => c[h] ?? ''))];
    downloadCSV(`${investment.name.replace(/\s+/g, '_')}_cashflows.csv`, rows);
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/investments')} className="mb-1"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">{investment.name}</h1>
          <p className="text-sm text-muted-foreground">{investment.projectName} • {investment.developer || '—'} • {investment.location || '—'}</p>
        </div>
        <Button variant="outline" onClick={() => setEditInvOpen(true)}><Pencil className="w-4 h-4 mr-2" />Edit</Button>
      </div>

      <Tabs defaultValue="cashflows">
        <TabsList>
          <TabsTrigger value="cashflows">Cash flows</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="cashflows" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { setEditingCf(null); setCfOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add payment</Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-2" />Import CSV</Button>
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

          <div className="text-sm text-muted-foreground">Total eligible paid: <span className="font-medium text-foreground">{fmtMoney(totalPaid, 2, investment.purchaseCurrency)}</span> ({eligible.length} payments) • Valuation date: {investment.valuationDate}</div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Currency</TableHead>
                  <TableHead>Description</TableHead><TableHead>Inst. #</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No payments. Add one or import a CSV.</TableCell></TableRow>}
                {filtered.map(c => {
                  const afterValuation = investment.valuationDate && c.status === 'paid' && !(c.date < investment.valuationDate);
                  return (
                    <TableRow key={c.id} className={afterValuation ? 'bg-amber-50' : ''}>
                      <TableCell className="whitespace-nowrap">{c.date}</TableCell>
                      <TableCell>{fmtMoney(c.amount, 2, c.currency)}</TableCell>
                      <TableCell>{c.currency}</TableCell>
                      <TableCell>{c.description || '—'}</TableCell>
                      <TableCell>{c.installmentNumber || '—'}</TableCell>
                      <TableCell>{c.paymentType || '—'}</TableCell>
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
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Property details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                <Info label="Property type" value={investment.propertyType} />
                <Info label="Unit number" value={investment.unitNumber} />
                <Info label="Location" value={investment.location} />
                <Info label="Purchase currency" value={investment.purchaseCurrency} />
                <Info label="Contract date" value={investment.contractDate} />
                <Info label="Analysis start" value={investment.analysisStartDate} />
                <Info label="Valuation date" value={investment.valuationDate} />
                <Info label="Original contract value" value={investment.originalContractValue ? fmtMoney(investment.originalContractValue, 2, investment.purchaseCurrency) : '—'} />
                <Info label="Current valuation" value={fmtMoney(investment.currentValuation, 2, investment.currentValuationCurrency)} />
                <Info label="Description" value={investment.description} />
                <Info label="Notes" value={investment.notes} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {analysis && <DataQualityPanel analysis={analysis} />}
          {analysis && <AnalysisTable analysis={analysis} investment={investment} />}
          <Button asChild variant="outline"><Link to="/analysis" onClick={() => setSelectedInvestment(investment.id)}>Open full analysis</Link></Button>
        </TabsContent>
      </Tabs>

      <CashFlowForm open={cfOpen} onClose={() => setCfOpen(false)} investmentId={id} valuationDate={investment.valuationDate} cashFlow={editingCf} />
      <InvestmentForm open={editInvOpen} onClose={() => setEditInvOpen(false)} investment={investment} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} type="cashflow" ctx={{ investmentId: id, valuationDate: investment.valuationDate }} />

      <AlertDialog open={!!toDeleteCf} onOpenChange={o => !o && setToDeleteCf(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment?</AlertDialogTitle>
            <AlertDialogDescription>This payment record will be permanently deleted.</AlertDialogDescription>
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
  return <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">{bad.length} paid payment(s) are on or after the valuation date ({investment.valuationDate}) and are excluded from valuation calculations. Edit the payment date or the valuation date.</div>;
}

function Info({ label, value }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5">{value || '—'}</dd></div>;
}