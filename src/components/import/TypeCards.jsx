import { Coins, Building2, DollarSign, TrendingUp } from 'lucide-react';
import { IMPORT_TYPES, TYPE_ORDER } from '@/lib/importEngine';
import { Badge } from '@/components/ui/badge';

const ICONS = { cashflow: Building2, gold: Coins, fx: DollarSign, cpi: TrendingUp };

export default function TypeCards({ selected, counts, lastResults, onSelect }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {TYPE_ORDER.map(t => {
        const cfg = IMPORT_TYPES[t];
        const Icon = ICONS[t];
        const active = selected === t;
        const last = lastResults?.[t];
        return (
          <button key={t} onClick={() => onSelect(t)}
            className={`text-left p-5 rounded-xl border transition-colors ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40 hover:bg-muted/50'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-heading font-semibold">{cfg.label}</div>
                  <Badge variant="outline" className="mt-1">{counts[t] || 0} existing</Badge>
                </div>
              </div>
              {active && <Badge>Selected</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-3">{cfg.description}</p>
            <div className="mt-3 text-xs text-muted-foreground">
              Supports: CSV file, Excel (.xlsx), paste from spreadsheet
              {last && <span className="block mt-1 text-foreground">Last import: {last.inserted} inserted, {last.replaced} replaced, {last.skipped} skipped • {new Date(last.timestamp).toLocaleString()}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}