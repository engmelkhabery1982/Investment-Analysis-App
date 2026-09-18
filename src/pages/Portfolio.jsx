import { Link } from 'react-router-dom';
import { usePortfolio, useStore } from '@/lib/hooks';
import { setSelectedInvestment } from '@/lib/store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MetricCard from '@/components/MetricCard';
import EmptyState from '@/components/EmptyState';
import { fmtMoney, fmtPct, fmtNumber } from '@/lib/format';
import { typeLabel } from '@/lib/portfolio';
import { INVESTMENT_TYPES } from '@/lib/model';
import { AlertTriangle, Download } from 'lucide-react';
import { downloadCSV } from '@/lib/csv';
import { portfolioSummaryRows } from '@/lib/summaryExport';

export default function Portfolio() {
  const s = useStore();
  const portfolio = usePortfolio();

  if (s.investments.length === 0) {
    return <EmptyState title="No investments" description="Create investments to see portfolio aggregation." actionLabel="Create investment" actionTo="/investments" />;
  }

  const t = portfolio.totals;
  const cur = s.settings.defaultCurrency || 'EGP';
  const typeEntries = Object.entries(portfolio.allocationByType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const statusEntries = Object.entries(portfolio.allocationByStatus).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(...typeEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground">{t.count} investment{t.count === 1 ? '' : 's'} • aggregated from the centralized performance engine</p>
          <p className="text-xs text-muted-foreground mt-1">
            Reporting / as-of date: <span className="font-medium text-foreground">{portfolio.reportingAsOf || '—'}</span>
            {' • '}valuation-date mode: <span className="font-medium text-foreground">{portfolio.valuationDateMode || 'single'}</span>
            {' • '}XIRR mode: <span className="font-medium text-foreground">{portfolio.portfolioXIRRMode || 'combined-dated'}</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => downloadCSV('portfolio_summary.csv', portfolioSummaryRows(portfolio, s))}><Download className="w-4 h-4 mr-2" />Export summary</Button>
      </div>

      {portfolio.warnings && portfolio.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm mb-1"><AlertTriangle className="w-4 h-4" />Portfolio metric notes</div>
          <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
            {portfolio.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Invested capital" value={fmtMoney(t.totalInvestedCapital, 2, cur)} />
        <MetricCard label="Economic value" value={fmtMoney(t.totalEconomicValue, 2, cur)} />
        <MetricCard label="Gain / loss" value={fmtMoney(t.totalGain, 2, cur)} tone={t.totalGain > 0 ? 'pos' : t.totalGain < 0 ? 'neg' : ''} />
        <MetricCard label="Portfolio ROI" value={fmtPct(t.portfolioROI)} tone={t.portfolioROI > 0 ? 'pos' : t.portfolioROI < 0 ? 'neg' : ''} />
        <MetricCard label="Portfolio MOIC" value={t.totalInvestedCapital > 0 ? t.portfolioMOIC.toFixed(2) + 'x' : 'N/A'} />
        <MetricCard label="Portfolio XIRR" value={t.portfolioXIRR != null ? fmtPct(t.portfolioXIRR) : 'N/A'} sub={t.portfolioXIRR == null ? 'No sign change across flows' : ''} />
        <MetricCard label="Real return (inflation-adj.)" value={t.totalRealInvested > 0 ? fmtPct(t.portfolioRealReturn) : 'N/A'} tone={t.portfolioRealReturn > 0 ? 'pos' : t.portfolioRealReturn < 0 ? 'neg' : ''} />
        <MetricCard label="Real invested capital" value={fmtMoney(t.totalRealInvested, 2, cur)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Allocation by investment type</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {typeEntries.length === 0 && <div className="text-sm text-muted-foreground">No invested capital.</div>}
            {typeEntries.map(([type, val]) => (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1"><span>{typeLabel(type)}</span><span className="text-muted-foreground">{fmtMoney(val, 2, cur)} ({fmtPct(t.totalInvestedCapital > 0 ? val / t.totalInvestedCapital : 0)})</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(val / maxType) * 100}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Allocation by status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {statusEntries.length === 0 && <div className="text-sm text-muted-foreground">No invested capital.</div>}
            {statusEntries.map(([status, val]) => (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1"><span>{status}</span><span className="text-muted-foreground">{fmtMoney(val, 2, cur)}</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-secondary" style={{ width: `${t.totalInvestedCapital > 0 ? (val / t.totalInvestedCapital) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Investments</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead>
                  <TableHead>Invested</TableHead><TableHead>Economic value</TableHead><TableHead>Gain</TableHead>
                  <TableHead>ROI</TableHead><TableHead>MOIC</TableHead><TableHead>XIRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolio.items.map(({ investment: inv, analysis }) => {
                  const p = analysis.performance;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        <Link to={`/investments/${inv.id}`} className="hover:underline" onClick={() => setSelectedInvestment(inv.id)}>{inv.name}</Link>
                      </TableCell>
                      <TableCell>{typeLabel(inv.type)}</TableCell>
                      <TableCell><Badge variant="outline">{inv.status || 'Active'}</Badge></TableCell>
                      <TableCell>{fmtMoney(p.netInvestedCapital, 2, inv.baseCurrency || cur)}</TableCell>
                      <TableCell>{fmtMoney(p.totalEconomicValue, 2, inv.baseCurrency || cur)}</TableCell>
                      <TableCell className={p.gain > 0 ? 'text-green-600' : p.gain < 0 ? 'text-destructive' : ''}>{fmtMoney(p.gain, 2, inv.baseCurrency || cur)}</TableCell>
                      <TableCell>{fmtPct(p.simpleROI)}</TableCell>
                      <TableCell>{p.netInvestedCapital > 0 ? p.moic.toFixed(2) + 'x' : 'N/A'}</TableCell>
                      <TableCell>{p.xirrVal != null ? fmtPct(p.xirrVal) : 'N/A'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}