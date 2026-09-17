import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fmtMoney, fmtNumber, fmtPct } from '@/lib/format';
import * as D from '@/lib/decimal';

export default function AnalysisTable({ analysis, investment }) {
  if (!analysis) return null;
  const cur = investment?.currentValuationCurrency || 'EGP';
  const propValue = investment.currentValuation;

  function row(name, invested, units, value, gain, ret, diffNumerator, notes, complete) {
    return (
      <TableRow>
        <TableCell className="font-medium">{name}</TableCell>
        <TableCell>{fmtMoney(invested, 2, cur)}</TableCell>
        <TableCell>{units == null ? 'n/a' : fmtNumber(units, 4)}</TableCell>
        <TableCell>{fmtMoney(value, 2, cur)}</TableCell>
        <TableCell className={D.gt(gain, 0) ? 'text-green-600' : D.lt(gain, 0) ? 'text-destructive' : ''}>{fmtMoney(gain, 2, cur)}</TableCell>
        <TableCell>{fmtPct(ret)}</TableCell>
        <TableCell className={D.gt(diffNumerator, 0) ? 'text-green-600' : D.lt(diffNumerator, 0) ? 'text-destructive' : ''}>{fmtMoney(diffNumerator, 2, cur)}</TableCell>
        <TableCell><Badge variant={complete ? 'secondary' : 'outline'}>{complete ? 'Complete' : 'Partial'}</Badge></TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-[200px]">{notes}</TableCell>
      </TableRow>
    );
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alternative</TableHead>
            <TableHead>Cash invested</TableHead>
            <TableHead>Units accumulated</TableHead>
            <TableHead>Current / liquidation value</TableHead>
            <TableHead>Gain / Loss</TableHead>
            <TableHead>Return %</TableHead>
            <TableHead>Diff vs property</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {row('Property', analysis.prop.totalPaid, null, propValue, analysis.prop.nominalGain, analysis.prop.nominalReturnFraction, 0, 'User-entered valuation', true)}
          {row('Gold', analysis.gold.totalPaid, analysis.gold.totalQty, analysis.gold.liquidation, analysis.gold.gain, analysis.gold.returnFraction, D.sub(propValue, analysis.gold.liquidation), analysis.gold.complete ? '' : 'Missing gold data', analysis.gold.complete)}
          {Object.keys(analysis.fx).map(cur2 => {
            const r = analysis.fx[cur2];
            return row(`${cur2} (FX)`, r.totalPaid, r.totalQty, r.liquidation, r.gain, r.returnFraction, D.sub(propValue, r.liquidation), r.complete ? '' : `Missing ${cur2}/EGP data`, r.complete);
          })}
          {row('Inflation (CPI)', analysis.cpi.totalOriginal, null, analysis.cpi.totalAdjusted, analysis.cpi.gain, analysis.cpi.returnFraction, D.sub(propValue, analysis.cpi.totalAdjusted), analysis.cpi.complete ? '' : 'Missing CPI data', analysis.cpi.complete)}
        </TableBody>
      </Table>
    </div>
  );
}