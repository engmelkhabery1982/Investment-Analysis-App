import { useSelectedInvestment, useAnalysis, useStore } from '@/lib/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { fmtMoney, fmtPct, fmtNumber } from '@/lib/format';
import * as D from '@/lib/decimal';
import EmptyState from '@/components/EmptyState';
import DataQualityPanel from '@/components/DataQualityPanel';
import { ComparisonChart, CumulativeCashChart } from '@/components/Charts';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const s = useStore();
  const investment = useSelectedInvestment();
  const analysis = useAnalysis(investment?.id);

  if (s.investments.length === 0) {
    return <EmptyState title="Create your first investment" description="Start by creating a property investment, then enter your actual payments and market data to run the analysis."
      steps={['Create an investment', 'Enter your real installment payments and dates', 'Add or import gold, FX and CPI data', 'Enter the current property valuation', 'Run the analysis']}
      actionLabel="Create investment" actionTo="/investments" />;
  }

  if (!investment) {
    return <EmptyState title="No investment selected" description="Select an investment from the top selector, or create a new one." actionLabel="Go to investments" actionTo="/investments" />;
  }

  const cur = investment.currentValuationCurrency || 'EGP';
  const p = analysis.prop;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading tracking-tight">{investment.name}</h1>
        <p className="text-sm text-muted-foreground">Valuation date: {investment.valuationDate} • Currency: {cur}</p>
      </div>

      {analysis.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm mb-1"><AlertTriangle className="w-4 h-4" />Data warnings</div>
          <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
            {analysis.warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}
            {analysis.warnings.length > 6 && <li>...and {analysis.warnings.length - 6} more (see Audit)</li>}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Metric label="Total paid" value={fmtMoney(p.totalPaid, 2, cur)} />
        <Metric label="Current property value" value={fmtMoney(investment.currentValuation, 2, cur)} />
        <Metric label="Nominal gain / loss" value={fmtMoney(p.nominalGain, 2, cur)} tone={D.gt(p.nominalGain, 0) ? 'pos' : D.lt(p.nominalGain, 0) ? 'neg' : ''} />
        <Metric label="Nominal return" value={fmtPct(p.nominalReturnFraction)} tone={D.gt(p.nominalReturnFraction, 0) ? 'pos' : D.lt(p.nominalReturnFraction, 0) ? 'neg' : ''} />
        <Metric label="XIRR (annualized)" value={analysis.xirrVal != null ? fmtPct(analysis.xirrVal) : 'n/a'} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Data quality</h2>
        <DataQualityPanel analysis={analysis} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Alternative values at valuation date</CardTitle></CardHeader>
          <CardContent><ComparisonChart analysis={analysis} investment={investment} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Cumulative cash paid</CardTitle></CardHeader>
          <CardContent><CumulativeCashChart cashFlows={s.cashflows.filter(c => c.investmentId === investment.id)} valuationDate={investment.valuationDate} /></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AltCard label="Gold alternative" value={fmtMoney(analysis.gold.liquidation, 2, cur)} ret={fmtPct(analysis.gold.returnFraction)} qty={`${fmtNumber(analysis.gold.totalQty, 4)} g`} complete={analysis.gold.complete} />
        {Object.keys(analysis.fx).map(c => (
          <AltCard key={c} label={`${c} alternative`} value={fmtMoney(analysis.fx[c].liquidation, 2, cur)} ret={fmtPct(analysis.fx[c].returnFraction)} qty={fmtNumber(analysis.fx[c].totalQty, 2)} complete={analysis.fx[c].complete} />
        ))}
        <AltCard label="Inflation-adjusted payments" value={fmtMoney(analysis.cpi.totalAdjusted, 2, cur)} ret={fmtPct(analysis.cpi.returnFraction)} qty="n/a" complete={analysis.cpi.complete} />
      </div>

      <div className="flex gap-2">
        <Button asChild variant="outline"><Link to="/analysis">Full analysis <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
        <Button asChild variant="outline"><Link to="/audit">Audit trail <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  const color = tone === 'pos' ? 'text-green-600' : tone === 'neg' ? 'text-destructive' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-heading font-semibold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function AltCard({ label, value, ret, qty, complete }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          {!complete && <span className="text-[10px] text-amber-600">partial</span>}
        </div>
        <div className="text-xl font-heading font-semibold mt-1">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">Return: {ret} • Units: {qty}</div>
      </CardContent>
    </Card>
  );
}