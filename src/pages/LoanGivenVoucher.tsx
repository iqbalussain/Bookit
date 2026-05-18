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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { currencySymbols, type PaymentMethod } from '@/types';
import { ArrowLeft, Save, RefreshCw } from 'lucide-react';

type LoanGivenType = 'advance_salary' | 'loan_customer' | 'loan_vendor' | 'others';

export default function LoanGivenVoucher() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clients, accounts, addVoucher, generateVoucherNumber, postTransactionEntry, settings } = useApp();
  const currencySymbol = currencySymbols[settings.currency];

  const [voucherNumber] = useState(() => generateVoucherNumber('loan_given'));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [loanType, setLoanType] = useState<LoanGivenType>('loan_customer');
  const [amount, setAmount] = useState(0);
  const [interestRate, setInterestRate] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('bank');
  const [repaymentDate, setRepaymentDate] = useState('');
  const [narration, setNarration] = useState('');

  const party = clients.find((c) => c.id === partyId);
  const paymentAccountName = method === 'cash' ? 'Cash' : 'Bank';

  const handleSave = (andNew: boolean) => {
    if (!partyId) { toast({ title: 'Error', description: 'Select a party', variant: 'destructive' }); return; }
    if (amount <= 0) { toast({ title: 'Error', description: 'Amount must be > 0', variant: 'destructive' }); return; }

    const now = new Date().toISOString();
    const voucherId = crypto.randomUUID();
    const paymentAccountId = method === 'cash' ? 'acc-1000' : 'acc-1010';

    addVoucher({
      id: voucherId, number: voucherNumber, type: 'loan_given', date,
      partyName: party?.name || '', amount, narration, method,
      details: { partyId, loanType, interestRate, repaymentDate },
      createdAt: now,
    });

    try {
      postTransactionEntry({
        date, reference: voucherNumber,
        referenceType: 'loan_given', referenceId: voucherId,
        description: `Loan given to ${party?.name}`,
        lines: [
          { accountId: 'acc-1200', debit: amount, credit: 0 },
          { accountId: paymentAccountId, debit: 0, credit: amount },
        ],
        idempotencyKey: `loan_given:${voucherId}`,
      });
    } catch (err) {
      console.error('[Journal] Entry failed:', err);
      toast({ title: 'Journal entry failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }

    toast({ title: 'Loan recorded', description: `${voucherNumber} — ${currencySymbol}${amount.toLocaleString('en-IN')}` });

    if (andNew) {
      setPartyId(''); setAmount(0); setInterestRate(0); setRepaymentDate(''); setNarration('');
    } else {
      navigate('/vouchers');
    }
  };

  return (
    <div className="space-y-3 pb-20 lg:pb-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vouchers')} className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">Loan Given</h1>
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
            <Label className="text-xs">Party *</Label>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select party" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Loan Type</Label>
            <RadioGroup value={loanType} onValueChange={(v) => setLoanType(v as LoanGivenType)} className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5"><RadioGroupItem value="advance_salary" id="as" /><Label htmlFor="as" className="text-xs cursor-pointer">Advance Salary</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="loan_customer" id="lc" /><Label htmlFor="lc" className="text-xs cursor-pointer">Loan to Customer</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="loan_vendor" id="lv" /><Label htmlFor="lv" className="text-xs cursor-pointer">Loan to Vendor</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="others" id="lo" /><Label htmlFor="lo" className="text-xs cursor-pointer">Others</Label></div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Principal ({currencySymbol}) *</Label>
              <Input type="number" min="0" step="0.01" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Interest Rate (%)</Label>
              <Input type="number" min="0" step="0.1" value={interestRate || ''} onChange={(e) => setInterestRate(Number(e.target.value) || 0)} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Repayment Date</Label>
              <Input type="date" value={repaymentDate} onChange={(e) => setRepaymentDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Narration</Label>
            <Textarea value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Notes..." rows={2} className="resize-none text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Journal Preview */}
      {amount > 0 && (
        <Card className="bg-muted/30">
          <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Journal Preview</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="font-medium">Dr. Loans & Advances</span><span>{currencySymbol}{amount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-muted-foreground pl-4"><span>Cr. {paymentAccountName}</span><span>{currencySymbol}{amount.toLocaleString('en-IN')}</span></div>
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
