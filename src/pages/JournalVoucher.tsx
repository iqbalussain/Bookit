import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Save, BookOpen } from 'lucide-react';
import type { JournalLine, Voucher } from '@/types';
import { currencySymbols } from '@/types';

interface RowState { id: string; accountId: string; debit: number; credit: number; description: string; }
const newRow = (): RowState => ({ id: crypto.randomUUID(), accountId: '', debit: 0, credit: 0, description: '' });

export default function JournalVoucher() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accounts, addJournalVoucher, generateVoucherNumber, settings } = useApp();
  const currencySymbol = currencySymbols[settings.currency];
  const ledgerAccounts = useMemo(() => accounts.filter((account) => account.kind === 'ledger'), [accounts]);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [rows, setRows] = useState<RowState[]>([newRow(), newRow()]);

  const totalDebit = useMemo(() => rows.reduce((s, r) => s + (r.debit || 0), 0), [rows]);
  const totalCredit = useMemo(() => rows.reduce((s, r) => s + (r.credit || 0), 0), [rows]);
  const diff = totalDebit - totalCredit;
  const balanced = Math.abs(diff) < 0.001 && totalDebit > 0;

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeRow = (id: string) => {
    if (rows.length <= 2) {
      toast({ title: 'Minimum 2 lines required', variant: 'destructive' });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = () => {
    if (!balanced) {
      toast({ title: 'Not balanced', description: `Debits and credits must match.`, variant: 'destructive' });
      return;
    }
    if (rows.some((r) => !r.accountId)) {
      toast({ title: 'Account required', description: 'Pick an account for each line.', variant: 'destructive' });
      return;
    }
    const number = generateVoucherNumber('journal').replace('JOURNAL', 'JV');
    const voucher: Voucher = {
      id: crypto.randomUUID(),
      number,
      type: 'journal',
      date,
      partyName: 'Journal',
      amount: totalDebit,
      narration,
      method: 'journal',
      createdAt: new Date().toISOString(),
    };
    const lines: JournalLine[] = rows.map((r) => ({
      accountId: r.accountId, debit: r.debit || 0, credit: r.credit || 0, description: r.description,
    }));
    try {
      addJournalVoucher(voucher, lines);
      toast({ title: 'Journal voucher saved', description: number });
      navigate('/vouchers');
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3 pb-24 lg:pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vouchers')} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> New Journal Voucher
          </h1>
          <p className="text-xs text-muted-foreground">Non-cash adjustment entries (depreciation, accruals, corrections)</p>
        </div>
      </div>

      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Voucher Details</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Narration</Label>
            <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Reason for entry" className="h-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-2.5 px-3">
          <CardTitle className="text-sm">Entries</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((p) => [...p, newRow()])} className="h-7 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2">Account</th>
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2 w-28">Debit</th>
                  <th className="text-right py-2 w-28">Credit</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-1 min-w-[140px]">
                      <Select value={row.accountId} onValueChange={(v) => updateRow(row.id, { accountId: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Account" /></SelectTrigger>
                        <SelectContent>
                          {ledgerAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-1">
                      <Input value={row.description} onChange={(e) => updateRow(row.id, { description: e.target.value })} placeholder="Note" className="h-8 text-xs" />
                    </td>
                    <td className="py-2 pr-1">
                      <Input type="number" step="0.01" value={row.debit || ''} onChange={(e) => updateRow(row.id, { debit: Number(e.target.value) || 0, credit: 0 })} className="h-8 text-right text-xs" />
                    </td>
                    <td className="py-2 pr-1">
                      <Input type="number" step="0.01" value={row.credit || ''} onChange={(e) => updateRow(row.id, { credit: Number(e.target.value) || 0, debit: 0 })} className="h-8 text-right text-xs" />
                    </td>
                    <td className="py-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(row.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={2} className="py-2 text-right text-xs">Totals</td>
                  <td className="py-2 text-right">{currencySymbol}{totalDebit.toLocaleString('en-IN')}</td>
                  <td className="py-2 text-right">{currencySymbol}{totalCredit.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1 text-right text-xs text-muted-foreground">Difference</td>
                  <td colSpan={2} className={`py-1 text-right text-xs font-semibold ${balanced ? 'text-success' : 'text-destructive'}`}>
                    {currencySymbol}{Math.abs(diff).toLocaleString('en-IN')} {balanced ? '✓ Balanced' : ''}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-3 py-3">
          <Label className="text-xs">Long Narration (optional)</Label>
          <Textarea value={narration} onChange={(e) => setNarration(e.target.value)} rows={2} className="mt-1.5 resize-none text-sm" placeholder="Additional notes..." />
        </CardContent>
      </Card>

      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:relative p-3 lg:p-0 bg-background border-t lg:border-0 z-30">
        <Button onClick={handleSave} disabled={!balanced} className="w-full h-9">
          <Save className="mr-1.5 h-4 w-4" /> Save Journal Voucher
        </Button>
      </div>
    </div>
  );
}
