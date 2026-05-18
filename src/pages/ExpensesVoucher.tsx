import { useState } from 'react';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { currencySymbols, type PaymentMethod } from '@/types';
import { ArrowLeft, Save, Plus, Trash2, RefreshCw } from 'lucide-react';

interface ExpenseLine {
  id: string;
  accountId: string;
  amount: number;
  method: PaymentMethod;
  bankAccountId?: string;
}

export default function ExpensesVoucher() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accounts, addAccount, addVoucher, generateVoucherNumber, postTransactionEntry, settings } = useApp();
  const currencySymbol = currencySymbols[settings.currency];

  const expenseAccounts = accounts.filter((a) => a.kind === 'ledger' && a.type === 'expense');
  const bankAccounts = accounts.filter((a) => a.kind === 'ledger' && (a.id === 'acc-1000' || a.id === 'acc-1010' || (a.type === 'asset' && (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')))));

  const [voucherNumber] = useState(() => generateVoucherNumber('expense'));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payTo, setPayTo] = useState('');
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<ExpenseLine[]>([
    { id: crypto.randomUUID(), accountId: '', amount: 0, method: 'cash' },
  ]);

  // New account dialog
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCode, setNewAccountCode] = useState('');

  const total = lines.reduce((s, l) => s + l.amount, 0);

  const updateLine = (id: string, field: keyof ExpenseLine, value: any) => {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), accountId: '', amount: 0, method: 'cash' }]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddAccount = () => {
    if (!newAccountName || !newAccountCode) return;
    const account = {
      id: `acc-${crypto.randomUUID().slice(0, 8)}`,
      code: newAccountCode,
      name: newAccountName,
      type: 'expense' as const,
      kind: 'ledger' as const,
      parentId: 'grp-expense-root',
      isSystem: false,
    };
    addAccount(account);
    setShowNewAccount(false);
    setNewAccountName('');
    setNewAccountCode('');
    toast({ title: 'Account added', description: `${newAccountName} created` });
  };

  const getPaymentAccountId = (method: PaymentMethod) => method === 'cash' ? 'acc-1000' : 'acc-1010';

  const buildJournalLines = () => {
    const journalLines: { accountId: string; debit: number; credit: number; description?: string }[] = [];
    lines.forEach((l) => {
      if (l.accountId && l.amount > 0) {
        journalLines.push({ accountId: l.accountId, debit: l.amount, credit: 0 });
        journalLines.push({ accountId: getPaymentAccountId(l.method), debit: 0, credit: l.amount });
      }
    });
    return journalLines;
  };

  const handleSave = (andNew: boolean) => {
    if (!payTo.trim()) { toast({ title: 'Error', description: 'Pay To is required', variant: 'destructive' }); return; }
    if (lines.some((l) => !l.accountId || l.amount <= 0)) { toast({ title: 'Error', description: 'All lines must have an expense head and amount > 0', variant: 'destructive' }); return; }

    const journalLines = buildJournalLines();

    const now = new Date().toISOString();
    const voucherId = crypto.randomUUID();

    addVoucher({
      id: voucherId, number: voucherNumber, type: 'expense', date, partyName: payTo,
      amount: total, narration, method: lines[0].method, reference,
      details: { lines: lines.map((l) => ({ accountId: l.accountId, amount: l.amount, method: l.method })) },
      createdAt: now,
    });

    try {
      postTransactionEntry({
        date, reference: voucherNumber,
        referenceType: 'expense', referenceId: voucherId,
        description: `Expense: ${payTo}`,
        lines: journalLines,
        idempotencyKey: `expense:${voucherId}`,
      });
    } catch (err) {
      console.error('[Journal] Entry failed:', err);
      toast({ title: 'Journal entry failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }

    toast({ title: 'Expense recorded', description: `${voucherNumber} — ${currencySymbol}${total.toLocaleString('en-IN')}` });

    if (andNew) {
      setPayTo(''); setReference(''); setNarration('');
      setLines([{ id: crypto.randomUUID(), accountId: '', amount: 0, method: 'cash' }]);
    } else {
      navigate('/vouchers');
    }
  };

  return (
    <div className="space-y-3 pb-20 lg:pb-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vouchers')} className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">Expenses Voucher</h1>
          <p className="text-xs text-muted-foreground">{voucherNumber}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Voucher Details</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Voucher No.</Label>
              <Input value={voucherNumber} readOnly className="h-9 bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pay To *</Label>
            <Input value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="Vendor / Cash" className="h-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Expense Lines</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          {lines.map((line, idx) => (
            <div key={line.id} className="p-2.5 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground">Line {idx + 1}</span>
                {lines.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(line.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expense Head *</Label>
                <Select value={line.accountId} onValueChange={(v) => {
                  if (v === '__new__') { setShowNewAccount(true); return; }
                  updateLine(line.id, 'accountId', v);
                }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                    <SelectItem value="__new__">
                      <span className="flex items-center gap-1 text-primary"><Plus className="h-3 w-3" /> Add New Account</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount ({currencySymbol}) *</Label>
                  <Input type="number" min="0" step="0.01" value={line.amount || ''} onChange={(e) => updateLine(line.id, 'amount', Number(e.target.value) || 0)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mode</Label>
                  <Select value={line.method} onValueChange={(v) => updateLine(line.id, 'method', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full text-xs text-primary border-primary/30 hover:bg-primary/5" onClick={addLine}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
          </Button>
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase">Total</p>
              <p className="text-base font-bold">{currencySymbol}{total.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Additional</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference number" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Narration</Label>
            <Textarea value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Notes..." rows={2} className="resize-none text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Journal Preview */}
      {lines.some((l) => l.accountId && l.amount > 0) && (
        <Card className="bg-muted/30">
          <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Journal Preview</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-1 text-xs">
              {lines.filter((l) => l.accountId && l.amount > 0).map((l) => {
                const acc = accounts.find((a) => a.id === l.accountId);
                const payAcc = l.method === 'cash' ? 'Cash' : 'Bank';
                return (
                  <div key={l.id} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Dr. {acc?.name || '—'}</span>
                      <span>{currencySymbol}{l.amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground pl-4">
                      <span>Cr. {payAcc}</span>
                      <span>{currencySymbol}{l.amount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buttons */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:relative p-3 lg:p-0 bg-background border-t lg:border-0 z-30">
        <div className="flex gap-2 max-w-lg mx-auto">
          <Button variant="outline" className="flex-1 h-10 text-xs" onClick={() => navigate('/vouchers')}>Cancel</Button>
          <Button variant="outline" className="flex-1 h-10 text-xs" onClick={() => handleSave(true)}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />Save & New
          </Button>
          <Button className="flex-1 h-10 text-xs" onClick={() => handleSave(false)}>
            <Save className="mr-1 h-3.5 w-3.5" />Save
          </Button>
        </div>
      </div>

      {/* New Account Dialog */}
      <Dialog open={showNewAccount} onOpenChange={setShowNewAccount}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Add Expense Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Account Code</Label>
              <Input value={newAccountCode} onChange={(e) => setNewAccountCode(e.target.value)} placeholder="e.g. 5200" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account Name</Label>
              <Input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="e.g. Office Supplies" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleAddAccount} disabled={!newAccountName || !newAccountCode}>Add Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
