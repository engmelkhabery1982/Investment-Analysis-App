import { CheckCircle2, AlertTriangle } from 'lucide-react';

export default function DataQualityPanel({ analysis }) {
  if (!analysis) return null;
  const items = [
    { label: 'Gold', status: analysis.dataQuality.gold },
    { label: 'CPI', status: analysis.dataQuality.cpi },
    { label: 'Cash flows', status: analysis.dataQuality.cashFlows },
    ...Object.keys(analysis.fx).map(c => ({ label: c + '/EGP', status: analysis.dataQuality[c] })),
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(it => {
        const ok = it.status === 'Complete' || it.status === 'Valid';
        return (
          <div key={it.label} className={`flex items-center gap-2 rounded-md border p-3 ${ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            {ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
            <div>
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className={`text-sm font-medium ${ok ? 'text-green-700' : 'text-amber-700'}`}>{it.status}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}