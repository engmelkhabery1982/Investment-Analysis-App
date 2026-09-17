import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllAnalyses, useStore } from '@/lib/hooks';
import { setSelectedInvestment } from '@/lib/store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import { fmtMoney, fmtPct } from '@/lib/format';
import { typeLabel } from '@/lib/portfolio';

// Metrics compared side-by-side. Each row maps an analysis.performance field to
// a formatter; null/undefined are shown as "N/A" so unavailable metrics are
// explicit rather than forced to zero.
const METRICS = [
  { key: 'netInvestedCapital', label: 'Capital invested', fmt: (p, cur) => fmtMoney(p.netInvestedCapital, 2, cur) },
  { key: 'totalEconomicValue', label: 'Current / economic value', fmt: (p, cur) => fmtMoney(p.totalEconomicValue, 2, cur) },
  { key: 'gain', label: 'Gain / loss', fmt: (p, cur) => fmtMoney(p.gain, 2, cur), tone: true },
  { key: 'simpleROI', label: 'ROI', fmt: (p) => fmtPct(p.simpleROI), tone: true },
  { key: 'moic', label: 'MOIC', fmt: (p) => p.netInvestedCapital > 0 ? p.moic.toFixed(2) + 'x' : 'N/A' },
  { key: 'xirrVal', label: 'XIRR', fmt: (p) => p.xirrVal != null ? fmtPct(p.xirrVal) : 'N/A' },
  { key: 'annualizedReturn', label: 'Annualized return', fmt: (p) => p.annualizedReturn != null ? fmtPct(p.annualizedReturn) : 'N/A' },
  { key: 'realReturn', label: 'Real return', fmt: (p) => p.realInvestedCapital > 0 ? fmtPct(p.realReturn) : 'N/A' },
];

export default function Comparison() {
  const s = useStore();
  const all = useAllAnalyses();
  const [selected, setSelected] = useState(() => all.slice(0, Math.min(3, all.length)).map(x => x.investment.id));
  const [benchId, setBenchId] = useState('gold');

  if (s.investments.length === 0) {
    return <EmptyState title="No investments" description="Create investments to compare them." actionLabel="Create investment" actionTo="/investments" />;
  }

  const selectedItems = all.filter(x => selected.includes(x.investment.id));

  function toggle(id) {
    setSelected(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading tracking-tight">Comparison</h1>
        <p className="text-sm text-muted-foreground">Side-by-side normalized metrics across investment types.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Select investments</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {all.map(({ investment: inv }) => (
              <label key={inv.id} className="flex items-center gap-2 border rounded-md p-2 cursor-pointer hover:bg-muted/40">
                <input type="checkbox" checked={selected.includes(inv.id)} onChange={() => toggle(inv.id)} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{inv.name}</div>
                  <div className="text-xs text-muted-foreground">{typeLabel(inv.type)} • {inv.status || 'Active'}</div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Metrics</CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Opportunity cost vs</span>
                <Select value={benchId} onValueChange={setBenchId}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(selectedItems[0].analysis.benchmarks).map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    {selectedItems.map(({ investment: inv }) => (
                      <TableHead key={inv.id} className="min-w-[140px]">
                        <Link to={`/investments/${inv.id}`} className="hover:underline" onClick={() => setSelectedInvestment(inv.id)}>{inv.name}</Link>
                        <div className="text-xs font-normal text-muted-foreground">{typeLabel(inv.type)} • {inv.baseCurrency || s.settings.defaultCurrency}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {METRICS.map(m => (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      {selectedItems.map(({ investment: inv, analysis }) => {
                        const val = m.fmt(analysis.performance, inv.baseCurrency || s.settings.defaultCurrency);
                        const tone = m.tone && analysis.performance[m.key] > 0 ? 'text-green-600' : m.tone && analysis.performance[m.key] < 0 ? 'text-destructive' : '';
                        return <TableCell key={inv.id} className={tone}>{val}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">Opportunity cost ({selectedItems[0].analysis.benchmarks[benchId]?.label || benchId})</TableCell>
                    {selectedItems.map(({ investment: inv, analysis }) => {
                      const b = analysis.benchmarks[benchId];
                      const cur2 = inv.baseCurrency || s.settings.defaultCurrency;
                      return <TableCell key={inv.id} className={b && b.complete ? (b.opportunityCost > 0 ? 'text-green-600' : b.opportunityCost < 0 ? 'text-destructive' : '') : 'text-muted-foreground'}>{b && b.complete ? fmtMoney(b.opportunityCost, 2, cur2) : 'N/A'}</TableCell>;
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}