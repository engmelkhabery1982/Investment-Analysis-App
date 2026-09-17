import { useState, useMemo } from 'react';
import { useSelectedInvestment, useAnalysis, useStore } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/EmptyState';
import AuditTable from '@/components/AuditTable';
import { downloadCSV } from '@/lib/csv';

export default function Audit() {
  const s = useStore();
  const investment = useSelectedInvestment();
  const analysis = useAnalysis(investment?.id);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  if (s.investments.length === 0) return <EmptyState title="No investments" description="Create an investment to view its audit trail." actionLabel="Create investment" actionTo="/investments" />;
  if (!investment) return <EmptyState title="No investment selected" description="Select an investment from the top selector." actionLabel="Go to investments" actionTo="/investments" />;

  const types = useMemo(() => analysis ? [...new Set(analysis.audit.map(a => a.calculationType))] : [], [analysis]);
  const filtered = useMemo(() => (analysis?.audit || [])
    .filter(a => typeFilter === 'all' || a.calculationType === typeFilter)
    .filter(a => !search || (a.formula || '').toLowerCase().includes(search.toLowerCase()) || (a.paymentDate || '').includes(search)), [analysis, typeFilter, search]);

  function exportAudit() {
    if (!analysis) return;
    const headers = ['calcType', 'paymentDate', 'originalAmount', 'requestedDate', 'appliedDate', 'policy', 'side', 'appliedPrice', 'units', 'valuationDate', 'valuationPrice', 'liquidationValue', 'formula', 'result', 'warnings'];
    const rows = [headers, ...analysis.audit.map(a => [a.calculationType, a.paymentDate, a.originalAmount, a.requestedDate, a.appliedDate, a.policy, a.side, a.appliedPrice, a.units, a.valuationDate, a.valuationPrice, a.liquidationValue, a.formula, a.result, (a.warnings || []).join('; ')])];
    downloadCSV(`${investment.name.replace(/\s+/g, '_')}_audit.csv`, rows);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted-foreground">{investment.name} • {analysis?.audit.length || 0} records</p>
        </div>
        <Button variant="outline" onClick={exportAudit}>Export CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="border rounded-md text-sm px-2 py-2 bg-background" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All calculation types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <Input className="w-56" placeholder="Search formula/date" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <AuditTable audit={filtered} />
    </div>
  );
}