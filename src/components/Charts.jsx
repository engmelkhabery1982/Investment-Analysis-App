import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { fmtMoney } from '@/lib/format';
import * as D from '@/lib/decimal';
import { parseDate } from '@/lib/finance';

export function CumulativeCashChart({ cashFlows, valuationDate }) {
  const eligible = cashFlows.filter(c => c.status === 'paid').sort((a, b) => parseDate(a.date) - parseDate(b.date));
  let cum = 0;
  const data = [];
  for (const c of eligible) {
    cum = D.add(cum, c.amount);
    data.push({ date: c.date, cumulative: D.toNumber(cum) });
  }
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No paid cash flows to chart.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
        <Tooltip formatter={v => fmtMoney(v)} />
        <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Cumulative paid" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ComparisonChart({ analysis, investment }) {
  if (!analysis) return null;
  const cur = investment?.currentValuationCurrency || 'EGP';
  const data = [
    { name: 'Property', value: D.toNumber(investment.currentValuation) },
    { name: 'Gold', value: D.toNumber(analysis.gold.liquidation) },
    ...Object.keys(analysis.fx).map(c => ({ name: c, value: D.toNumber(analysis.fx[c].liquidation) })),
    { name: 'Inflation', value: D.toNumber(analysis.cpi.totalAdjusted) },
  ];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
        <Tooltip formatter={v => fmtMoney(v, 2, cur)} />
        <Legend />
        <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Value (EGP)" />
      </BarChart>
    </ResponsiveContainer>
  );
}