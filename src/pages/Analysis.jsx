import { useState } from 'react';
import { useSelectedInvestment, useAnalysis, useStore } from '@/lib/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import EmptyState from '@/components/EmptyState';
import AnalysisTable from '@/components/AnalysisTable';
import DataQualityPanel from '@/components/DataQualityPanel';
import { ComparisonChart } from '@/components/Charts';
import { fmtMoney, fmtNumber, fmtPct, fmtDate } from '@/lib/format';
import * as D from '@/lib/decimal';
import { downloadCSV } from '@/lib/csv';

export default function Analysis() {
  const s = useStore();
  const investment = useSelectedInvestment();
  const analysis = useAnalysis(investment?.id);
  const [detailTab, setDetailTab] = useState('gold');

  if (s.investments.length === 0) return <EmptyState title="No investments" description="Create an investment to run the analysis." actionLabel="Create investment" actionTo="/investments" />;
  if (!investment) return <EmptyState title="No investment selected" description="Select an investment from the top selector." actionLabel="Go to investments" actionTo="/investments" />;
  if (!analysis) return null;

  const cur = investment.currentValuationCurrency || 'EGP';
  const propValue = investment.currentValuation;

  function exportSummary() {
    const rows = [
      ['Metric', 'Value'],
      ['Total paid', fmtMoney(analysis.prop.totalPaid, 2, cur)],
      ['Current property value', fmtMoney(propValue, 2, cur)],
      ['Property nominal gain/loss', fmtMoney(analysis.prop.nominalGain, 2, cur)],
      ['Property nominal return', fmtPct(analysis.prop.nominalReturnFraction)],
      ['Property XIRR', analysis.xirrVal != null ? fmtPct(analysis.xirrVal) : 'n/a'],
      ['Gold liquidation value', fmtMoney(analysis.gold.liquidation, 2, cur)],
      ['Gold return', fmtPct(analysis.gold.returnFraction)],
      ['Inflation-adjusted value', fmtMoney(analysis.cpi.totalAdjusted, 2, cur)],
      ...Object.keys(analysis.fx).map(c => [`${c} liquidation value`, fmtMoney(analysis.fx[c].liquidation, 2, cur)]),
    ];
    downloadCSV(`${investment.name.replace(/\s+/g, '_')}_analysis.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">Analysis</h1>
          <p className="text-sm text-muted-foreground">{investment.name} • Valuation date {investment.valuationDate} • Policy: {s.settings.defaultDatePolicy}</p>
        </div>
        <Button variant="outline" onClick={exportSummary}>Export summary CSV</Button>
      </div>

      <DataQualityPanel analysis={analysis} />

      <Card>
        <CardHeader><CardTitle className="text-base">Comparison summary</CardTitle></CardHeader>
        <CardContent><AnalysisTable analysis={analysis} investment={investment} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Opportunity cost vs property</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <DiffRow label="Property vs Gold" value={D.sub(propValue, analysis.gold.liquidation)} cur={cur} />
            {Object.keys(analysis.fx).map(c => <DiffRow key={c} label={`Property vs ${c}`} value={D.sub(propValue, analysis.fx[c].liquidation)} cur={cur} />)}
            <DiffRow label="Property vs Inflation-adjusted payments" value={D.sub(propValue, analysis.cpi.totalAdjusted)} cur={cur} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Alternative values chart</CardTitle></CardHeader>
        <CardContent><ComparisonChart analysis={analysis} investment={investment} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Per-payment calculation detail</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList>
              <TabsTrigger value="gold">Gold</TabsTrigger>
              <TabsTrigger value="cpi">Inflation</TabsTrigger>
              {Object.keys(analysis.fx).map(c => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
            </TabsList>
            <TabsContent value="gold"><GoldDetail analysis={analysis} cur={cur} /></TabsContent>
            <TabsContent value="cpi"><CpiDetail analysis={analysis} cur={cur} /></TabsContent>
            {Object.keys(analysis.fx).map(c => (
              <TabsContent key={c} value={c}><FxDetail res={analysis.fx[c]} cur={cur} currency={c} /></TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function DiffRow({ label, value, cur }) {
  const tone = D.gt(value, 0) ? 'text-green-600' : D.lt(value, 0) ? 'text-destructive' : '';
  return <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">{label}</span><span className={`font-medium ${tone}`}>{fmtMoney(value, 2, cur)}</span></div>;
}

function GoldDetail({ analysis, cur }) {
  const g = analysis.gold;
  return (
    <div className="overflow-x-auto border rounded-md">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Payment date</TableHead><TableHead>Amount</TableHead><TableHead>Applied gold date</TableHead>
          <TableHead>Gold ask</TableHead><TableHead>Gold qty (g)</TableHead><TableHead>Warnings</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {g.rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{fmtDate(r.cf?.date)}</TableCell>
              <TableCell>{fmtMoney(r.cf?.amount, 2, cur)}</TableCell>
              <TableCell>{r.appliedDate ? fmtDate(r.appliedDate) : <span className="text-destructive">—</span>}</TableCell>
              <TableCell>{r.goldAsk != null ? fmtNumber(r.goldAsk, 2) : '—'}</TableCell>
              <TableCell>{r.qty != null ? fmtNumber(r.qty, 6) : '—'}</TableCell>
              <TableCell className="text-xs text-amber-700">{r.warning || ''}</TableCell>
            </TableRow>
          ))}
          {g.rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No eligible payments.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <div className="p-3 text-sm bg-muted/40 space-y-1">
        <div>Total gold quantity: <strong>{fmtNumber(g.totalQty, 6)} g</strong></div>
        <div>Valuation gold bid ({fmtDate(g.valDate)}): <strong>{fmtNumber(g.valBid, 2)}</strong></div>
        <div>Liquidation value: <strong>{fmtMoney(g.liquidation, 2, cur)}</strong></div>
      </div>
    </div>
  );
}

function FxDetail({ res, cur, currency }) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Payment date</TableHead><TableHead>Amount</TableHead><TableHead>Applied FX date</TableHead>
          <TableHead>{currency} ask</TableHead><TableHead>{currency} qty</TableHead><TableHead>Warnings</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {res.rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{fmtDate(r.cf?.date)}</TableCell>
              <TableCell>{fmtMoney(r.cf?.amount, 2, cur)}</TableCell>
              <TableCell>{r.appliedDate ? fmtDate(r.appliedDate) : <span className="text-destructive">—</span>}</TableCell>
              <TableCell>{r.fxAsk != null ? fmtNumber(r.fxAsk, 4) : '—'}</TableCell>
              <TableCell>{r.qty != null ? fmtNumber(r.qty, 4) : '—'}</TableCell>
              <TableCell className="text-xs text-amber-700">{r.warning || ''}</TableCell>
            </TableRow>
          ))}
          {res.rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No eligible payments.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <div className="p-3 text-sm bg-muted/40 space-y-1">
        <div>Total {currency}: <strong>{fmtNumber(res.totalQty, 4)}</strong></div>
        <div>Valuation {currency} bid ({fmtDate(res.valDate)}): <strong>{fmtNumber(res.valBid, 4)}</strong></div>
        <div>Liquidation value: <strong>{fmtMoney(res.liquidation, 2, cur)}</strong></div>
      </div>
    </div>
  );
}

function CpiDetail({ analysis, cur }) {
  const c = analysis.cpi;
  return (
    <div className="overflow-x-auto border rounded-md">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Payment date</TableHead><TableHead>Amount</TableHead><TableHead>Applied CPI date</TableHead>
          <TableHead>Payment CPI</TableHead><TableHead>Valuation CPI</TableHead><TableHead>Factor</TableHead><TableHead>Adjusted value</TableHead><TableHead>Warnings</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {c.rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{fmtDate(r.cf?.date)}</TableCell>
              <TableCell>{fmtMoney(r.cf?.amount, 2, cur)}</TableCell>
              <TableCell>{r.appliedDate ? fmtDate(r.appliedDate) : <span className="text-destructive">—</span>}</TableCell>
              <TableCell>{r.payCpi != null ? fmtNumber(r.payCpi, 2) : '—'}</TableCell>
              <TableCell>{r.valCpi != null ? fmtNumber(r.valCpi, 2) : '—'}</TableCell>
              <TableCell>{r.factor != null ? fmtNumber(r.factor, 4) : '—'}</TableCell>
              <TableCell>{r.adjusted != null ? fmtMoney(r.adjusted, 2, cur) : '—'}</TableCell>
              <TableCell className="text-xs text-amber-700">{r.warning || ''}</TableCell>
            </TableRow>
          ))}
          {c.rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No eligible payments.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <div className="p-3 text-sm bg-muted/40 space-y-1">
        <div>Total original: <strong>{fmtMoney(c.totalOriginal, 2, cur)}</strong></div>
        <div>Total inflation-adjusted: <strong>{fmtMoney(c.totalAdjusted, 2, cur)}</strong></div>
      </div>
    </div>
  );
}