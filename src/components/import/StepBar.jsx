const STEPS = ['Type', 'Source', 'Headers', 'Mapping', 'Preview', 'Result'];

export default function StepBar({ current }) {
  return (
    <div className="flex items-center gap-1 md:gap-2 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${active ? 'bg-primary-foreground/20' : done ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20'}`}>{idx}</span>
              <span className="font-medium">{label}</span>
            </div>
            {idx < STEPS.length && <div className="w-4 md:w-6 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}