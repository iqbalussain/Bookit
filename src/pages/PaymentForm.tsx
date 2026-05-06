import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { currencySymbols, type Payment } from '@/types';
import { safeRandomUUID } from '@/lib/uuid';
import { useDelayedMissingRedirect } from '@/hooks/useDelayedMissingRedirect';

export default function PaymentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { invoices, payments, addPayment, settings } = useApp();

  const invoice = useMemo(() => invoices.find((item) => item.id === id), [id, invoices]);
  useDelayedMissingRedirect(Boolean(id), Boolean(invoice), '/invoices');

  const total = Number(invoice?.netTotal) || 0;
  const paidAmount = useMemo(() => payments
    .filter((payment) => payment.invoiceId === invoice?.id)
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0), [invoice?.id, payments]);
  const balance = Math.max(total - paidAmount, 0);

  const [amount, setAmount] = useState(balance || total || 0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<Payment['method']>('cash');
  const [notes, setNotes] = useState('');

  const currencySymbol = currencySymbols[settings.currency];

  const handleSave = () => {
    if (!invoice) return;
    const numericAmount = Number(amount) || 0;
    if (numericAmount <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter an amount greater than zero.', variant: 'destructive' });
      return;
    }

    const payment: Payment = {
      id: safeRandomUUID(),
      invoiceId: invoice.id,
      invoiceType: 'sales',
      amount: numericAmount,
      date,
      method,
      notes,
      createdAt: new Date().toISOString(),
    };
    addPayment(payment);
    toast({ title: 'Payment recorded', description: `Payment saved for ${invoice.number}.` });
    navigate(`/invoices/${invoice.id}`);
  };

  if (!invoice) return null;

  return (
    <div className="space-y-4 pb-24 lg:pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/${invoice.id}`)} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Record Payment</h1>
          <p className="text-xs text-muted-foreground">{invoice.number}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Invoice Summary</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Total: {currencySymbol}{total.toLocaleString('en-IN')}</div>
          <div>Paid: {currencySymbol}{paidAmount.toLocaleString('en-IN')}</div>
          <div className="font-semibold">Balance: {currencySymbol}{balance.toLocaleString('en-IN')}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Payment Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as Payment['method'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        Save Payment
      </Button>
    </div>
  );
}
