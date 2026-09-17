import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fmtMoney, fmtNumber, fmtDate } from '@/lib/format';
import * as D from '@/lib/decimal';

export default function AuditTable({ audit }) {
  if (!audit || audit.length === 0) return <p className="text-sm text-muted-foreground">No audit records.</p>;
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Calc type</TableHead>
            <TableHead>Payment date</TableHead>
            <TableHead>Original amount</TableHead>
            <TableHead>Requested date</TableHead>
            <TableHead>Applied date</TableHead>
            <TableHead>Policy</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Applied price</TableHead>
            <TableHead>Units</TableHead>
            <TableHead>Valuation price</TableHead>
            <TableHead>Liquidation value</TableHead>
            <TableHead>Formula</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Warnings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audit.map((a, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium whitespace-nowrap">{a.calculationType}</TableCell>
              <TableCell>{fmtDate(a.paymentDate)}</TableCell>
              <TableCell>{a.originalAmount != null ? fmtMoney(a.originalAmount) : '—'}</TableCell>
              <TableCell>{fmtDate(a.requestedDate)}</TableCell>
              <TableCell>{a.appliedDate ? fmtDate(a.appliedDate) : <span className="text-destructive">none</span>}</TableCell>
              <TableCell className="capitalize">{a.policy}</TableCell>
              <TableCell>{a.side}</TableCell>
              <TableCell>{a.appliedPrice != null ? fmtNumber(a.appliedPrice, 4) : '—'}</TableCell>
              <TableCell>{a.units != null ? fmtNumber(a.units, 6) : '—'}</TableCell>
              <TableCell>{a.valuationPrice != null ? fmtNumber(a.valuationPrice, 4) : '—'}</TableCell>
              <TableCell>{a.liquidationValue != null ? fmtMoney(a.liquidationValue) : '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[240px]">{a.formula}</TableCell>
              <TableCell className="font-mono text-xs">{a.result != null ? fmtNumber(a.result, 4) : '—'}</TableCell>
              <TableCell>{a.warnings && a.warnings.length > 0 ? a.warnings.map((w, j) => <Badge key={j} variant="outline" className="mr-1 text-amber-700 border-amber-300">{w}</Badge>) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}