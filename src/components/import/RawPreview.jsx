import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function RawPreview({ headers, dataRows }) {
  const visible = dataRows.slice(0, 50);
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">{dataRows.length} data rows detected • {headers.length} columns. Showing first {visible.length}.</div>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>{headers.map((h, i) => <TableHead key={i} className="whitespace-nowrap">{h || `Col ${i + 1}`}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r, i) => (
              <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className="whitespace-nowrap text-xs">{c}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Badge variant="outline">First row treated as headers</Badge>
    </div>
  );
}