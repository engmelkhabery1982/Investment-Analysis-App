import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fmtMoney, fmtPct } from '@/lib/format';

// Renders the universal benchmark results from analysis.benchmarks.
// Single source of truth: values come straight from the centralized engine.
export default function BenchmarksTable({ benchmarks, currency = 'EGP' }) {
  const rows = Object.values(benchmarks || {});
  if (!rows.length) return <div className="text-sm text-muted-foreground">No benchmarks configured.</div>;
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Benchmark</TableHead>
            <TableHead>Cash invested</TableHead>
            <TableHead>Current value</TableHead>
            <TableHead>Gain / Loss</TableHead>
            <TableHead>Return</TableHead>
            <TableHead>Opportunity cost</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => {
            const gainTone = r.gain > 0 ? 'text-green-600' : r.gain < 0 ? 'text-destructive' : '';
            const oppTone = r.opportunityCost > 0 ? 'text-green-600' : r.opportunityCost < 0 ? 'text-destructive' : '';
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell>{fmtMoney(r.invested, 2, currency)}</TableCell>
                <TableCell>{fmtMoney(r.value, 2, currency)}</TableCell>
                <TableCell className={gainTone}>{fmtMoney(r.gain, 2, currency)}</TableCell>
                <TableCell>{r.invested > 0 ? fmtPct(r.returnFraction) : 'N/A'}</TableCell>
                <TableCell className={oppTone}>{fmtMoney(r.opportunityCost, 2, currency)}</TableCell>
                <TableCell><Badge variant={r.complete ? 'secondary' : 'outline'}>{r.complete ? 'Complete' : 'Partial'}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}