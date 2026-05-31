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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { currencySymbols } from '@/types';
import { ArrowLeft, Save, RefreshCw } from 'lucide-react';

type TransferType = 'cash_to_bank' | 'bank_to_cash' | 'bank_to_bank';

export default function ContraVoucher() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accounts, addVoucher, generateVoucherNumber, postTransactionEntry, settings } = useApp();
  const currencySymbol = currencySymbols[settings.currency];

  const cashBankAccounts = useMemo(() =>
    accounts.filter((a) => a.kind === 'ledger' && (a.id === 'acc-1000' || a.id === 'acc-1010' || (a.type === 'asset' && (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash'))))),
    [accounts]
  );

  const [voucherNumber] = useState(() => generateVoucherNumber('contra'));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferType, setTransferType] = useState<TransferType>('cash_to_bank');
  const [fromAccountId, setFromAccountId] = useState('acc-1000');
  const [toAccountId, setToAccountId] = useState('acc-1010');
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');

  const handleTransferTypeChange = (type: TransferType) => {
    setTransferType(type);
    if (type === 'cash_to_bank') { setFromAccountId('acc-1000'); setToAccountId('acc-1010'); }
    else if (type === 'bank_to_cash') { setFromAccountId('acc-1010'); setToAccountId('acc-1000'); }
    else { setFromAccountId('acc-1010'); setToAccountId(''); }
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const handleSave = (andNew: boolean) => {
    if (amount <= 0) { toast({ title: 'Error', description: 'Amount must be > 0', variant: 'destructive' }); return; }
    if (!fromAccountId || !toAccountId) { toast({ title: 'Error', description: 'Select both accounts', variant: 'destructive' }); return; }
    if (fromAccountId === toAccountId) { toast({ title: 'Error', description: 'From and To accounts cannot be the same', variant: 'destructive' }); return; }

    const now = new Date().toISOString();
    const voucherId = crypto.randomUUID();

    addVoucher({
      id: voucherId, number: voucherNumber, type: 'contra', date,
      partyName: `${fromAccount?.name} → ${toAccount?.name}`,
      amount, narration, method: 'bank', reference,
      details: { transferType, fromAccountId, toAccountId },
      createdAt: now,
    });

    try {
      postTransactionEntry({
        date, reference: voucherNumber,
        referenceType: 'contra', referenceId: voucherId,
        description: `Contra: ${fromAccount?.name} → ${toAccount?.name}`,
        lines: [
          { accountId: toAccountId, debit: amount, credit: 0 },
          { accountId: fromAccountId, debit: 0, credit: amount },
        ],
        idempotencyKey: `contra:${voucherId}`,
      });
    } catch (err) {
      console.error('[Journal] Entry failed:', err);
      toast({ title: 'Journal entry failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }

    toast({ title: 'Contra recorded', description: `${voucherNumber} — ${currencySymbol}${amount.toLocaleString('en-IN')}` });

    if (andNew) {
      setAmount(0); setReference(''); setNarration('');
    } else {
      navigate('/vouchers');
    }
  };

  return (
    <div className="space-y-3 pb-20 lg:pb-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vouchers')} className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">Contra Voucher</h1>
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
            <Label className="text-xs">Transfer Type</Label>
            <RadioGroup value={transferType} onValueChange={(v) => handleTransferTypeChange(v as TransferType)} className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="cash_to_bank" id="ctb" />
                <Label htmlFor="ctb" className="text-xs cursor-pointer">Cash → Bank</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="bank_to_cash" id="btc" />
                <Label htmlFor="btc" className="text-xs cursor-pointer">Bank → Cash</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="bank_to_bank" id="btb" />
                <Label htmlFor="btb" className="text-xs cursor-pointer">Bank → Bank</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From Account *</Label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cashBankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To Account *</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {cashBankAccounts.filter((a) => a.id !== fromAccountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Amount ({currencySymbol}) *</Label>
            <Input type="number" min="0" step="0.01" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Narration</Label>
            <Textarea value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Notes..." rows={2} className="resize-none text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Journal Preview */}
      {amount > 0 && fromAccountId && toAccountId && fromAccountId !== toAccountId && (
        <Card className="bg-muted/30">
          <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Journal Preview</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="font-medium">Dr. {toAccount?.name}</span><span>{currencySymbol}{amount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-muted-foreground pl-4"><span>Cr. {fromAccount?.name}</span><span>{currencySymbol}{amount.toLocaleString('en-IN')}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
