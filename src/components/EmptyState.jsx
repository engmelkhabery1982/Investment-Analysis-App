import { Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmptyState({ title, description, steps = [], actionLabel, actionTo }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-5">
        <Building2 className="w-7 h-7 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-heading tracking-tight mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      {steps.length > 0 && (
        <ol className="text-left space-y-2 mb-7 max-w-md w-full">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">{i + 1}</span>
              <span className="text-foreground/80 pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {actionLabel && actionTo && (
        <Button asChild>
          <Link to={actionTo}>{actionLabel} <ArrowRight className="w-4 h-4 ml-2" /></Link>
        </Button>
      )}
    </div>
  );
}