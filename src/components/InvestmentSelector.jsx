import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setSelectedInvestment } from '@/lib/store';
import { useStore } from '@/lib/hooks';

export default function InvestmentSelector() {
  const s = useStore();
  return (
    <Select value={s.settings.selectedInvestmentId || ''} onValueChange={v => setSelectedInvestment(v)}>
      <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select investment" /></SelectTrigger>
      <SelectContent>
        {s.investments.length === 0 && <SelectItem value={null} disabled>No investments yet</SelectItem>}
        {s.investments.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}