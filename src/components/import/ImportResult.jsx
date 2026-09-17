import { CheckCircle2, XCircle, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ImportResult({ result, onDownloadErrors, onRestart }) {
  if (!result) return null;
  const { inserted, replaced, skipped, duplicatesSkipped, rejected, warnings, errors, rejectedRows } = result;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {rejected === 0 && errors === 0
          ? <CheckCircle2 className="w-8 h-8 text-green-600" />
          : <XCircle className="w-8 h-8 text-amber-600" />}
        <div>
          <h2 className="text-xl font-heading">Import complete</h2>
          <p className="text-sm text-muted-foreground">{inserted} inserted • {replaced} replaced • {skipped} skipped ({duplicatesSkipped} duplicates)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Inserted" value={inserted} tone="green" />
        <Stat label="Replaced" value={replaced} tone="blue" />
        <Stat label="Skipped" value={skipped} tone="muted" />
        <Stat label="Rejected" value={rejected} tone={rejected ? "red" : "muted"} />
      </div>

      {(warnings > 0 || errors > 0) && (
        <div className="text-sm text-muted-foreground">{warnings} row(s) with warnings, {errors} row(s) with errors.</div>
      )}

      {rejectedRows && rejectedRows.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Rejected rows</h3>
              <Button size="sm" variant="outline" onClick={onDownloadErrors}><Download className="w-4 h-4 mr-2" />Download rejection CSV</Button>
            </div>
            <div className="border rounded-md max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0"><tr><th className="text-left p-2">Row</th><th className="text-left p-2">Reason</th></tr></thead>
                <tbody>
                  {rejectedRows.map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.row}</td><td className="p-2 text-destructive">{r.reason}</td></tr>)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={onRestart}><RotateCcw className="w-4 h-4 mr-2" />Start another import</Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = { green: 'text-green-600', blue: 'text-blue-600', red: 'text-destructive', muted: 'text-muted-foreground' };
  return (
    <div className="border rounded-lg p-4">
      <div className="text-2xl font-heading font-semibold">{value}</div>
      <div className={`text-xs ${tones[tone] || 'text-muted-foreground'}`}>{label}</div>
    </div>
  );
}