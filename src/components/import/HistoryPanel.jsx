import { History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMPORT_TYPES } from '@/lib/importEngine';

export default function HistoryPanel({ history, onClear }) {
  if (!history || history.length === 0) {
    return <div className="text-sm text-muted-foreground flex items-center gap-2"><History className="w-4 h-4" />No imports yet.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2"><History className="w-4 h-4" />Import history (local)</h3>
        <Button size="sm" variant="outline" onClick={onClear}><Trash2 className="w-4 h-4 mr-1" />Clear</Button>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted"><tr>
            <th className="text-left p-2">When</th><th className="text-left p-2">Type</th><th className="text-left p-2">Source</th>
            <th className="text-right p-2">Rows</th><th className="text-right p-2">Inserted</th><th className="text-right p-2">Replaced</th>
            <th className="text-right p-2">Skipped</th><th className="text-right p-2">Rejected</th>
          </tr></thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{new Date(h.timestamp).toLocaleString()}</td>
                <td className="p-2">{IMPORT_TYPES[h.type]?.label || h.type}</td>
                <td className="p-2 max-w-[200px] truncate">{h.fileName || '—'}</td>
                <td className="p-2 text-right">{h.rowsReceived}</td>
                <td className="p-2 text-right text-green-600">{h.inserted}</td>
                <td className="p-2 text-right text-blue-600">{h.replaced}</td>
                <td className="p-2 text-right">{h.skipped}</td>
                <td className="p-2 text-right text-destructive">{h.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}