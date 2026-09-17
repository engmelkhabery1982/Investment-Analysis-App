import { Card, CardContent } from '@/components/ui/card';

export default function MetricCard({ label, value, sub, tone }) {
  const color = tone === 'pos' ? 'text-green-600' : tone === 'neg' ? 'text-destructive' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-heading font-semibold mt-1 ${color}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}