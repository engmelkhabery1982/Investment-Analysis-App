import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useStore } from '@/lib/hooks';
import { deleteInvestment, setSelectedInvestment } from '@/lib/store';
import { fmtMoney } from '@/lib/format';
import InvestmentForm from '@/components/InvestmentForm';
import EmptyState from '@/components/EmptyState';

export default function Investments() {
  const s = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  if (s.investments.length === 0 && !formOpen) {
    return <>
      <EmptyState title="Create your first investment" description="Add a property investment record to begin tracking payments and running comparisons."
        actionLabel="Create investment" actionTo="#" />
      <div className="flex justify-center"><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" />Create investment</Button></div>
    </>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-tight">Investments</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" />New investment</Button>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Project</TableHead><TableHead>Currency</TableHead>
              <TableHead>Contract date</TableHead><TableHead>Valuation date</TableHead><TableHead>Current value</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.investments.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">
                  <Link to={`/investments/${i.id}`} className="hover:underline" onClick={() => setSelectedInvestment(i.id)}>{i.name}</Link>
                </TableCell>
                <TableCell>{i.projectName || '—'}</TableCell>
                <TableCell>{i.purchaseCurrency}</TableCell>
                <TableCell>{i.contractDate || '—'}</TableCell>
                <TableCell>{i.valuationDate || '—'}</TableCell>
                <TableCell>{fmtMoney(i.currentValuation, 2, i.currentValuationCurrency)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(i); setFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    <Button variant="ghost" size="icon" asChild><Link to={`/investments/${i.id}`} onClick={() => setSelectedInvestment(i.id)}><ArrowRight className="w-4 h-4" /></Link></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InvestmentForm open={formOpen} onClose={() => setFormOpen(false)} investment={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete investment?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete "{toDelete?.name}" and all its cash-flow records. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteInvestment(toDelete.id); setToDelete(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}