import { useSelectedInvestment, useAnalysis, useStore } from '@/lib/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import DataQualityPanel from '@/components/DataQualityPanel';
import PerformanceGrid from '@/components/PerformanceGrid';
import { ComparisonChart, CumulativeCashChart } from '@/components/Charts';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, LayoutGrid, GitCompare } from 'lucide-react';
import GovernanceBadge from '@/components/GovernanceBadge';

export default function Dashboard() {
  const s = useStore();
  const investment = useSelectedInvestment();
  const analysis = useAnalysis(investment?.id);

  if (s.investments.length === 0) {
    return <EmptyState title="Create your first investment" description="Add any investment type — real estate, gold, currency, stock, deposit and more — then enter transactions and market data to analyze performance."
      steps={['Create an investment', 'Enter your transactions (purchases, income, fees)', 'Add or import gold, FX and CPI data', 'Enter the current / terminal value', 'Run the analysis']}
      actionLabel="Create investment" actionTo="/investments" />;
  }

  if (!investment) {
    return <EmptyState title="No investment selected" description="Select an investment from the top selector, or create a new one." actionLabel="Go to investments" actionTo="/investments" />;
  }

  const cur = investment.baseCurrency || investment.currentValuationCurrency || investment.purchaseCurrency || 'EGP';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">{investment.name}</h1>
          <p className="text-sm text-muted-foreground">Valuation date: {investment.valuationDate} • Currency: {cur} • Policy: {s.settings.defaultDatePolicy}</p>
          <div className="mt-1 flex items-center gap-2"><span className="text-xs text-muted-foreground">Data status:</span><GovernanceBadge status={analysis.governance?.status || 'READY'} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/portfolio"><LayoutGrid className="w-4 h-4 mr-2" />Portfolio</Link></Button>
          <Button asChild variant="outline"><Link to="/comparison"><GitCompare className="w-4 h-4 mr-2" />Compare</Link></Button>
          <Button asChild variant="outline"><Link to={`/investments/${investment.id}`}>Workspace <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
        </div>
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

      <PerformanceGrid analysis={analysis} currency={cur} />

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
          <CardHeader><CardTitle className="text-base">Cumulative cash flow</CardTitle></CardHeader>
          <CardContent><CumulativeCashChart cashFlows={s.cashflows.filter(c => c.investmentId === investment.id)} valuationDate={investment.valuationDate} /></CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="outline"><Link to="/analysis">Full analysis <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
        <Button asChild variant="outline"><Link to="/audit">Audit trail <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
      </div>
    </div>
  );
}