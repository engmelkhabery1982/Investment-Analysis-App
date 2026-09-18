import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, AlertCircle, Ban } from 'lucide-react';

// Concise governance status — one badge. Detailed evidence lives in the
// Data Quality Control Center and Audit Center, not on the Dashboard.
const MAP = {
  READY: { icon: CheckCircle2, variant: 'secondary', tone: 'text-green-600', label: 'Healthy' },
  WARNING: { icon: AlertTriangle, variant: 'outline', tone: 'text-amber-600', label: 'Warning' },
  INCOMPLETE: { icon: AlertCircle, variant: 'outline', tone: 'text-orange-600', label: 'Incomplete' },
  INVALID: { icon: Ban, variant: 'destructive', tone: 'text-destructive', label: 'Blocking' },
  PARTIAL: { icon: AlertTriangle, variant: 'outline', tone: 'text-amber-600', label: 'Partial' },
  DEMO: { icon: AlertCircle, variant: 'outline', tone: 'text-muted-foreground', label: 'Demo' },
};

export default function GovernanceBadge({ status }) {
  const m = MAP[status] || MAP.READY;
  const Icon = m.icon;
  return (
    <Badge variant={m.variant} className={`gap-1 ${m.tone}`}>
      <Icon className="w-3.5 h-3.5" />
      {m.label}
    </Badge>
  );
}