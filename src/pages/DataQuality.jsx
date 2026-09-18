import { Link } from 'react-router-dom';
import { useDataQuality, useStore } from '@/lib/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import GovernanceBadge from '@/components/GovernanceBadge';
import EmptyState from '@/components/EmptyState';
import { SEVERITY } from '@/lib/governance';

const SEV_TONE = { BLOCKING: 'destructive', ERROR: 'destructive', WARNING: 'outline', INFO: 'secondary' };

export default function DataQuality() {
  const s = useStore();
  const dq = useDataQuality();

  if (s.investments.length === 0) return <EmptyState title="No investments" description="Create an investment to assess data quality." actionLabel="Create investment" actionTo="/investments" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">Data Quality Control Center</h1>
          <p className="text-sm text-muted-foreground">Portfolio-wide integrity from the governance engine • worst issues first</p>
        </div>
        <GovernanceBadge status={dq.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><div className="text-2xl font-heading">{dq.counts.BLOCKING}</div><div className="text-xs text-muted-foreground">Blocking</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-2xl font-heading text-destructive">{dq.counts.ERROR}</div><div className="text-xs text-muted-foreground">Errors</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-2xl font-heading text-amber-600">{dq.counts.WARNING}</div><div className="text-xs text-muted-foreground">Warnings</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-2xl font-heading">{dq.counts.INFO}</div><div className="text-xs text-muted-foreground">Info</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Missing benchmark data (investments affected)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <MissingStat label="Gold" value={dq.missing.gold} to="/market-data" />
            <MissingStat label="FX" value={dq.missing.fx} to="/market-data" />
            <MissingStat label="CPI / Inflation" value={dq.missing.cpi} to="/market-data" />
            <MissingStat label="Custom benchmarks" value={dq.missing.custom} to="/settings" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">Missing data is never converted to zero — affected benchmarks are marked incomplete and their metrics shown as N/A.</p>
        </CardContent>
      </Card>

      {dq.gaps.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Date-resolution gaps (largest per investment / benchmark)</CardTitle></CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Investment</TableHead><TableHead>Benchmark</TableHead><TableHead>Payment date</TableHead><TableHead>Applied date</TableHead><TableHead>Gap (days)</TableHead><TableHead>Classification</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dq.gaps.map((g, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium"><Link to={`/investments/${g.investmentId}`} className="hover:underline">{g.investmentName}</Link></TableCell>
                      <TableCell>{g.benchmark}</TableCell>
                      <TableCell>{g.paymentDate}</TableCell>
                      <TableCell>{g.appliedDate}</TableCell>
                      <TableCell>{g.gapDays}</TableCell>
                      <TableCell><Badge variant={g.severity === 'ERROR' ? 'destructive' : 'outline'}>{g.classification}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Issues ({dq.issues.length})</CardTitle></CardHeader>
        <CardContent>
          {dq.issues.length === 0 ? <div className="text-sm text-muted-foreground">No data-quality issues detected.</div> : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Severity</TableHead><TableHead>Code</TableHead><TableHead>Category</TableHead><TableHead>Investment</TableHead><TableHead>Message</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dq.issues.map((iss, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant={SEV_TONE[iss.severity] || 'outline'}>{iss.severity}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{iss.code}</TableCell>
                      <TableCell className="text-xs">{iss.category}</TableCell>
                      <TableCell className="text-xs">{iss.investmentId ? <Link to={`/investments/${iss.investmentId}`} className="hover:underline">{iss.investmentName || '—'}</Link> : <span className="text-muted-foreground">portfolio</span>}</TableCell>
                      <TableCell className="text-sm">{iss.message}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{iss.action || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <Link to="/data-import"><Badge variant="outline" className="cursor-pointer">Go to Import Center</Badge></Link>
            <Link to="/market-data"><Badge variant="outline" className="cursor-pointer">Go to Market Data</Badge></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MissingStat({ label, value, to }) {
  return (
    <Link to={to} className="border rounded-lg p-3 hover:bg-muted/40">
      <div className={`text-xl font-heading ${value > 0 ? 'text-amber-600' : 'text-green-600'}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}