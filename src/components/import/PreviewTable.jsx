import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IMPORT_TYPES, STATUS } from '@/lib/importEngine';
import { fmtNumber } from '@/lib/format';

const STATUS_BADGE = {
  [STATUS.NEW]: <Badge className="bg-blue-100 text-blue-700">New</Badge>,
  [STATUS.DUPLICATE]: <Badge className="bg-amber-100 text-amber-700">Duplicate</Badge>,
  [STATUS.CONFLICT]: <Badge className="bg-orange-100 text-orange-700">Conflict</Badge>,
  [STATUS.ERROR]: <Badge variant="destructive">Error</Badge>,
};

const FILTERS = ['all', 'ready', 'warnings', 'errors', 'duplicates', 'conflicts'];

export default function PreviewTable({ type, prepared, actions, setAction, conflictAction, setConflictAction, filter, setFilter }) {
  const cfg = IMPORT_TYPES[type];
  const displayFields = cfg.fields.filter(f => !['pair'].includes(f.key));

  function applyToAllConflicts(action) {
    prepared.forEach(p => { if (p.status === STATUS.CONFLICT) setAction(p.rowIndex, action); });
  }

  const filtered = prepared.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'ready') return actions[p.rowIndex] === 'insert' || actions[p.rowIndex] === 'replace' || actions[p.rowIndex] === 'keep';
    if (filter === 'warnings') return p.warnings.length > 0;
    if (filter === 'errors') return p.errors.length > 0;
    if (filter === 'duplicates') return p.status === STATUS.DUPLICATE;
    if (filter === 'conflicts') return p.status === STATUS.CONFLICT;
    return true;
  });

  const visible = filtered.slice(0, 500);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="capitalize">{f}</Button>)}
        <span className="text-xs text-muted-foreground ml-2">{filtered.length} shown{filtered.length > visible.length ? ` (first 500 of ${filtered.length})` : ''}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 border rounded-lg p-3 bg-muted/30">
        <span className="text-sm font-medium">Default for conflicts:</span>
        {['skip', 'replace', 'keep'].map(a => (
          <label key={a} className="flex items-center gap-1.5 text-sm">
            <input type="radio" checked={conflictAction === a} onChange={() => setConflictAction(a)} /> {a === 'keep' ? 'Keep both' : a}
          </label>
        ))}
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => applyToAllConflicts('skip')}>Skip all conflicts</Button>
          <Button size="sm" variant="outline" onClick={() => applyToAllConflicts('replace')}>Replace all conflicts</Button>
          <Button size="sm" variant="outline" onClick={() => applyToAllConflicts('keep')}>Keep all conflicts</Button>
        </span>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              {displayFields.map(f => <TableHead key={f.key} className="whitespace-nowrap">{f.label}</TableHead>)}
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Warnings / errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && <TableRow><TableCell colSpan={displayFields.length + 5} className="text-center text-muted-foreground py-6">No rows to display.</TableCell></TableRow>}
            {visible.map(p => {
              const b = p.built;
              const action = actions[p.rowIndex];
              return (
                <TableRow key={p.rowIndex} className={p.errors.length ? 'bg-red-50' : p.warnings.length ? 'bg-amber-50' : ''}>
                  <TableCell className="text-xs text-muted-foreground">{p.rowIndex + 2}</TableCell>
                  {displayFields.map(f => {
                    const v = b[f.key];
                    return <TableCell key={f.key} className="whitespace-nowrap text-xs">{f.numeric ? (v === '' || v == null ? '—' : fmtNumber(v, 4)) : (v || '—')}</TableCell>;
                  })}
                  <TableCell>{STATUS_BADGE[p.status]}</TableCell>
                  <TableCell>
                    {p.status === STATUS.ERROR ? <span className="text-xs text-destructive">rejected</span> :
                      p.status === STATUS.NEW ? <span className="text-xs text-blue-600">insert</span> :
                      <select className="border rounded text-xs px-1 py-1 bg-background" value={action} onChange={e => setAction(p.rowIndex, e.target.value)}>
                        {p.status === STATUS.CONFLICT && <option value="skip">Skip</option>}
                        {p.status === STATUS.CONFLICT && <option value="replace">Replace</option>}
                        {p.status === STATUS.CONFLICT && <option value="keep">Keep both</option>}
                        {p.status === STATUS.DUPLICATE && <option value="skip">Skip</option>}
                        {p.status === STATUS.DUPLICATE && <option value="keep">Keep both</option>}
                      </select>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.errors.length > 0 && <div className="text-destructive">{p.errors.join('; ')}</div>}
                    {p.warnings.length > 0 && <div className="text-amber-600">{p.warnings.join('; ')}</div>}
                    {!p.errors.length && !p.warnings.length && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}