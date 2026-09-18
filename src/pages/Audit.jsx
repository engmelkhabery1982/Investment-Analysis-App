import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuditRows, useStore } from '@/lib/hooks';
import { filterAudit, auditCSVRows } from '@/lib/auditAggregator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import EmptyState from '@/components/EmptyState';
import { downloadCSV } from '@/lib/csv';
import { fmtNumber } from '@/lib/format';

const STATUS_TONE = { OK: 'secondary', WARNING: 'outline', ERROR: 'destructive', INFO: 'outline' };

export default function Audit() {
  const s = useStore();
  const rows = useAuditRows();
  const [invFilter, setInvFilter] = useState('all');
  const [benchFilter, setBenchFilter] = useState('all');
  const [date, setDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const benchmarks = useMemo(() => [...new Set(rows.map(r => r.benchmark))].sort(), [rows]);
  const filtered = useMemo(() => filterAudit(rows, { investmentId: invFilter, benchmark: benchFilter, date, status: statusFilter }), [rows, invFilter, benchFilter, date, statusFilter]);

  if (s.investments.length === 0) return <EmptyState title="No investments" description="Create an investment to view its audit trail." actionLabel="Create investment" actionTo="/investments" />;

  function exportAudit() {
    downloadCSV('audit_center.csv', auditCSVRows(filtered));
  }

  const visible = filtered.slice(0, 500);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">Audit Center</h1>
          <p className="text-sm text-muted-foreground">{rows.length} traceable records across {s.investments.length} investment{s.investments.length === 1 ? '' : 's'} • evidence emitted by the calculation engines</p>
        </div>
        <Button variant="outline" onClick={exportAudit} disabled={!filtered.length}>Export CSV</Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select className="border rounded-md text-sm px-2 py-2 bg-background" value={invFilter} onChange={e => setInvFilter(e.target.value)}>
          <option value="all">All investments</option>
          {s.investments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select className="border rounded-md text-sm px-2 py-2 bg-background" value={benchFilter} onChange={e => setBenchFilter(e.target.value)}>
          <option value="all">All benchmarks</option>
          {benchmarks.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="border rounded-md text-sm px-2 py-2 bg-background" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="OK">OK</option>
          <option value="WARNING">Warning</option>
          <option value="ERROR">Error</option>
          <option value="INFO">Info</option>
        </select>
        <Input className="w-40" type="text" placeholder="Filter by date (YYYY-MM-DD)" value={date} onChange={e => setDate(e.target.value)} />
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} shown{filtered.length > visible.length ? ` (first 500)` : ''}</span>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investment</TableHead><TableHead>Type</TableHead><TableHead>Benchmark</TableHead>
              <TableHead>Payment date</TableHead><TableHead>Amount</TableHead><TableHead>Dir</TableHead><TableHead>Txn type</TableHead>
              <TableHead>Requested</TableHead><TableHead>Applied</TableHead><TableHead>Policy</TableHead><TableHead>Side</TableHead>
              <TableHead>Applied price</TableHead><TableHead>Units</TableHead><TableHead>Result</TableHead><TableHead>Source</TableHead>
              <TableHead>Status</TableHead><TableHead>Warnings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && <TableRow><TableCell colSpan={17} className="text-center text-muted-foreground py-6">No audit records match the filters.</TableCell></TableRow>}
            {visible.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium whitespace-nowrap"><Link to={`/investments/${r.investmentId}`} className="hover:underline">{r.investmentName}</Link></TableCell>
                <TableCell className="text-xs">{r.investmentType}</TableCell>
                <TableCell className="text-xs">{r.benchmark}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{r.paymentDate || '—'}</TableCell>
                <TableCell className="text-xs">{r.paymentAmount !== '' ? fmtNumber(r.paymentAmount, 2) : '—'}</TableCell>
                <TableCell className="text-xs">{r.direction || '—'}</TableCell>
                <TableCell className="text-xs">{r.transactionType || '—'}</TableCell>
                <TableCell className="text-xs">{r.requestedDate || '—'}</TableCell>
                <TableCell className="text-xs">{r.appliedDate || <span className="text-destructive">none</span>}</TableCell>
                <TableCell className="text-xs capitalize">{r.policy || '—'}</TableCell>
                <TableCell className="text-xs">{r.side || '—'}</TableCell>
                <TableCell className="text-xs">{r.appliedPrice !== '' ? fmtNumber(r.appliedPrice, 4) : '—'}</TableCell>
                <TableCell className="text-xs">{r.units !== '' ? fmtNumber(r.units, 6) : '—'}</TableCell>
                <TableCell className="text-xs">{r.result !== '' ? fmtNumber(r.result, 4) : '—'}</TableCell>
                <TableCell className="text-xs">{r.source || '—'}</TableCell>
                <TableCell><Badge variant={STATUS_TONE[r.status] || 'outline'} className="text-xs">{r.status}</Badge></TableCell>
                <TableCell className="text-xs text-amber-700 max-w-[200px]">{r.warnings || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}