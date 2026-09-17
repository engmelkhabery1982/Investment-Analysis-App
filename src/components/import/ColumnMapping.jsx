import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IMPORT_TYPES } from '@/lib/importEngine';

const DATE_FORMATS = [
  { value: 'auto', label: 'Auto-detect (ISO preferred)' },
  { value: 'ymd', label: 'YYYY-MM-DD' },
  { value: 'dmy', label: 'DD/MM/YYYY' },
  { value: 'mdy', label: 'MM/DD/YYYY' },
];
const NUMBER_FORMATS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'us', label: '1,000.50 (US)' },
  { value: 'eu', label: '1.000,50 (EU)' },
];

export default function ColumnMapping({ type, headers, map, setMap, dateFormat, setDateFormat, numberFormat, setNumberFormat, ambiguousCount, investments, investmentId, setInvestmentId, settings }) {
  const cfg = IMPORT_TYPES[type];

  function setField(key, idx) {
    const next = { ...map };
    if (idx === '') delete next[key]; else next[key] = idx;
    setMap(next);
  }

  return (
    <div className="space-y-5">
      {type === 'cashflow' && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <Label className="text-xs">Assign to investment *</Label>
          <Select value={investmentId || ''} onValueChange={v => setInvestmentId(v)}>
            <SelectTrigger className="w-full max-w-md mt-1"><SelectValue placeholder="Select an investment" /></SelectTrigger>
            <SelectContent>
              {investments.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {investmentId && (() => { const inv = investments.find(i => i.id === investmentId); return inv ? <p className="text-xs text-muted-foreground mt-1">Valuation date: {inv.valuationDate} • Currency: {inv.purchaseCurrency}</p> : null; })()}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div>
          <Label className="text-xs">Date format</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger className="w-56 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{DATE_FORMATS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
          {ambiguousCount > 0 && dateFormat === 'auto' && <p className="text-xs text-amber-600 mt-1">{ambiguousCount} row(s) have ambiguous dates (e.g. 03/04/2025). Pick DD/MM or MM/DD to resolve.</p>}
        </div>
        <div>
          <Label className="text-xs">Number format</Label>
          <Select value={numberFormat} onValueChange={setNumberFormat}>
            <SelectTrigger className="w-56 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{NUMBER_FORMATS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr><th className="text-left p-3 font-medium">Application field</th><th className="text-left p-3 font-medium">Required</th><th className="text-left p-3 font-medium">Source column</th></tr>
          </thead>
          <tbody>
            {cfg.fields.map(f => (
              <tr key={f.key} className="border-t">
                <td className="p-3">{f.label}</td>
                <td className="p-3">{f.required ? <Badge variant="destructive">Required</Badge> : <Badge variant="outline">Optional</Badge>}</td>
                <td className="p-3">
                  <Select value={map[f.key] != null ? String(map[f.key]) : ''} onValueChange={v => setField(f.key, v === '' ? '' : Number(v))}>
                    <SelectTrigger className="w-full max-w-xs"><SelectValue placeholder="— unmapped —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>— unmapped —</SelectItem>
                      {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Mappings are proposed automatically but you can change any of them. Unmapped required fields will cause validation errors in the next step.</p>
    </div>
  );
}