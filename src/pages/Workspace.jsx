import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, FlaskConical, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { useStore, useAnalysis, useScenarios } from '@/lib/hooks';
import { setSelectedInvestment, addScenario, updateScenario, deleteScenario } from '@/lib/store';
import { INVESTMENT_TYPES, CLOSED_STATUSES } from '@/lib/model';
import { applyScenario } from '@/lib/scenarios';
import { fmtMoney, fmtPct } from '@/lib/format';
import { downloadCSV } from '@/lib/csv';
import { investmentSummaryRows } from '@/lib/summaryExport';
import EmptyState from '@/components/EmptyState';
import InvestmentForm from '@/components/InvestmentForm';
import TransactionsPanel from '@/components/TransactionsPanel';
import PerformanceGrid from '@/components/PerformanceGrid';
import BenchmarksTable from '@/components/BenchmarksTable';
import DataQualityPanel from '@/components/DataQualityPanel';
import ScenarioForm from '@/components/ScenarioForm';

export default function Workspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const s = useStore();
  const investment = s.investments.find(i => i.id === id);
  const analysis = useAnalysis(id);
  const scenarios = useScenarios(id);

  const [editInvOpen, setEditInvOpen] = useState(false);
  const [scnOpen, setScnOpen] = useState(false);
  const [editingScn, setEditingScn] = useState(null);

  useEffect(() => { if (id) setSelectedInvestment(id); }, [id]);

  if (!investment) {
    return <div className="py-10 text-center">
      <p className="text-muted-foreground mb-3">Investment not found.</p>
      <Button asChild><Link to="/investments">Back to investments</Link></Button>
    </div>;
  }
  if (!analysis) return null;

  const cur = investment.baseCurrency || investment.purchaseCurrency || s.settings.defaultCurrency;
  const isClosed = CLOSED_STATUSES.includes(investment.status);
  const typeMeta = INVESTMENT_TYPES[investment.type] || { label: investment.type || 'Unknown' };

  function saveScenario(payload) {
    if (!payload) { setScnOpen(false); setEditingScn(null); return; }
    if (editingScn) updateScenario(editingScn.id, { name: payload.name, overrides: payload.overrides });
    else addScenario({ name: payload.name, investmentId: id, overrides: payload.overrides });
    setScnOpen(false); setEditingScn(null);
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/investments')} className="mb-1"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">{investment.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Badge variant="secondary">{typeMeta.label}</Badge>
            <Badge variant="outline">{investment.status || 'Active'}</Badge>
            <span>• {cur}</span>
            <span>• Valuation {investment.valuationDate || '—'}</span>
            {isClosed && <Badge variant="outline">Closed — terminal value forced 0</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadCSV(`${investment.name.replace(/\s+/g, '_')}_summary.csv`, investmentSummaryRows(analysis, investment))}><Download className="w-4 h-4 mr-2" />Export summary</Button>
          <Button variant="outline" onClick={() => setEditInvOpen(true)}><Pencil className="w-4 h-4 mr-2" />Edit</Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <PerformanceGrid analysis={analysis} currency={cur} />
          <Card>
            <CardHeader><CardTitle className="text-base">Identity & valuation</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
                <Info label="Type" value={typeMeta.label} />
                <Info label="Status" value={investment.status || 'Active'} />
                <Info label="Base currency" value={cur} />
                <Info label="Valuation date" value={investment.valuationDate || '—'} />
                <Info label="Current / terminal value" value={fmtMoney(investment.currentValuation, 2, cur)} />
                <Info label="Contract date" value={investment.contractDate || '—'} />
                <Info label="Location" value={investment.location || '—'} />
                <Info label="Description" value={investment.description || '—'} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Governance & integrity</CardTitle><Badge variant={analysis.governance.status === 'READY' ? 'secondary' : 'outline'}>{analysis.governance.status}</Badge></div></CardHeader>
            <CardContent className="space-y-3">
              <DataQualityPanel analysis={analysis} />
              {analysis.governance.issues.length > 0 && (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader><TableRow><TableHead>Severity</TableHead><TableHead>Code</TableHead><TableHead>Message</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {analysis.governance.issues.map((iss, i) => (
                        <TableRow key={i}>
                          <TableCell><Badge variant={iss.severity === 'BLOCKING' ? 'destructive' : iss.severity === 'ERROR' ? 'secondary' : 'outline'}>{iss.severity}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{iss.code}</TableCell>
                          <TableCell className="text-sm">{iss.message}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{iss.action || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsPanel investment={investment} />
        </TabsContent>

        <TabsContent value="benchmarks" className="space-y-3">
          <p className="text-sm text-muted-foreground">Benchmark results use the same-cash-flow principle. Opportunity cost = benchmark value − this investment's economic value.</p>
          <BenchmarksTable benchmarks={analysis.benchmarks} currency={cur} />
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Scenarios</h2>
              <p className="text-xs text-muted-foreground">Test alternative assumptions without modifying actual data.</p>
            </div>
            <Button onClick={() => { setEditingScn(null); setScnOpen(true); }}><Plus className="w-4 h-4 mr-2" />New scenario</Button>
          </div>
          {scenarios.length === 0 && <div className="text-sm text-muted-foreground border rounded-md p-4">No scenarios yet. Create one to compare against the base case.</div>}
          <div className="space-y-4">
            {scenarios.map(scn => (
              <ScenarioRow key={scn.id} scenario={scn} investment={investment} state={s} cur={cur}
                onEdit={() => { setEditingScn(scn); setScnOpen(true); }}
                onDelete={() => deleteScenario(scn.id)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <InvestmentForm open={editInvOpen} onClose={() => setEditInvOpen(false)} investment={investment} />
      <ScenarioForm open={scnOpen} onClose={saveScenario} scenario={editingScn} investment={investment} customBenchmarks={s.customBenchmarks} />
    </div>
  );
}

function ScenarioRow({ scenario, investment, state, cur, onEdit, onDelete }) {
  const transactions = state.cashflows.filter(c => c.investmentId === investment.id);
  const base = useAnalysis(investment.id);
  const scenarioCtx = useMemo(() => applyScenario({
    investment, transactions,
    gold: state.gold, fx: state.fx, cpi: state.cpi,
    customBenchmarks: state.customBenchmarks, settings: state.settings,
  }, scenario.overrides), [scenario, investment, transactions, state]);

  const sc = scenarioCtx.analysis.performance;
  const bp = base.performance;

  const rows = [
    { label: 'Invested capital', base: fmtMoney(bp.netInvestedCapital, 2, cur), scn: fmtMoney(sc.netInvestedCapital, 2, cur), diff: sc.netInvestedCapital - bp.netInvestedCapital, money: true },
    { label: 'Economic value', base: fmtMoney(bp.totalEconomicValue, 2, cur), scn: fmtMoney(sc.totalEconomicValue, 2, cur), diff: sc.totalEconomicValue - bp.totalEconomicValue, money: true },
    { label: 'Gain / loss', base: fmtMoney(bp.gain, 2, cur), scn: fmtMoney(sc.gain, 2, cur), diff: sc.gain - bp.gain, money: true },
    { label: 'ROI', base: fmtPct(bp.simpleROI), scn: fmtPct(sc.simpleROI), diff: sc.simpleROI - bp.simpleROI, pct: true },
    { label: 'MOIC', base: bp.netInvestedCapital > 0 ? bp.moic.toFixed(2) + 'x' : 'N/A', scn: sc.netInvestedCapital > 0 ? sc.moic.toFixed(2) + 'x' : 'N/A', diff: null },
    { label: 'XIRR', base: bp.xirrVal != null ? fmtPct(bp.xirrVal) : 'N/A', scn: sc.xirrVal != null ? fmtPct(sc.xirrVal) : 'N/A', diff: (bp.xirrVal != null && sc.xirrVal != null) ? sc.xirrVal - bp.xirrVal : null, pct: true },
    { label: 'Real return', base: bp.realInvestedCapital > 0 ? fmtPct(bp.realReturn) : 'N/A', scn: sc.realInvestedCapital > 0 ? fmtPct(sc.realReturn) : 'N/A', diff: (bp.realInvestedCapital > 0 && sc.realInvestedCapital > 0) ? sc.realReturn - bp.realReturn : null, pct: true },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FlaskConical className="w-4 h-4" />{scenario.name}</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {scenarioCtx.warnings.length > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">{scenarioCtx.warnings.join(' ')}</div>
        )}
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Metric</TableHead><TableHead>Base case</TableHead><TableHead>Scenario</TableHead><TableHead>Difference</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(r => {
                const diffStr = r.diff == null ? '—' : (r.pct ? fmtPct(r.diff) : fmtMoney(r.diff, 2, cur));
                const tone = r.diff == null ? '' : r.diff > 0 ? 'text-green-600' : r.diff < 0 ? 'text-destructive' : '';
                return (
                  <TableRow key={r.label}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell>{r.base}</TableCell>
                    <TableCell>{r.scn}</TableCell>
                    <TableCell className={tone}>{r.pct && r.diff != null && r.diff > 0 ? '+' : ''}{diffStr}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5">{value || '—'}</dd></div>;
}