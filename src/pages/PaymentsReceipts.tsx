import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { currencySymbols, type Payment, type PaymentMethod } from '@/types';
import { ArrowDownLeft, ArrowUpRight, Save, CreditCard, Banknote, Building2, Globe } from 'lucide-react';

export default function PaymentsReceipts() {
  const { toast } = useToast();
  const {
    clients, invoices, purchaseInvoices, payments,
    addPayment, updateInvoice, updatePurchaseInvoice,
    getClient, settings, postTransactionEntry, calculateInvoicePaymentStatus,
  } = useApp();

  const currencySymbol = currencySymbols[settings.currency];
  const [mode, setMode] = useState<'receipt' | 'payment'>('receipt');
  const [partyId, setPartyId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('bank');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Filter parties by mode
  const parties = useMemo(() => {
    if (mode === 'receipt') return clients.filter((c) => c.type === 'customer' || c.type === 'both');
    return clients.filter((c) => c.type === 'vendor' || c.type === 'both');
  }, [clients, mode]);

  // Get relevant invoices for selected party
  const partyInvoices = useMemo(() => {
    if (!partyId) return [];
    if (mode === 'receipt') {
      return invoices.filter((i) => i.clientId === partyId && i.status !== 'paid' && i.status !== 'draft' && i.status !== 'cancelled');
    }
    return purchaseInvoices.filter((p) => p.vendorId === partyId && p.status !== 'paid');
  }, [partyId, mode, invoices, purchaseInvoices]);

  // Calculate balance for selected invoice
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    if (mode === 'receipt') {
      const inv = invoices.find((i) => i.id === selectedInvoiceId);
      if (!inv) return null;
      const paid = payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
      return { ...inv, paid, balance: inv.netTotal - paid };
    }
    const pi = purchaseInvoices.find((p) => p.id === selectedInvoiceId);
    if (!pi) return null;
    const paid = payments.filter((p) => p.invoiceId === pi.id).reduce((s, p) => s + p.amount, 0);
    return { ...pi, paid, balance: pi.netTotal - paid };
  }, [selectedInvoiceId, mode, invoices, purchaseInvoices, payments]);

  const resetForm = () => {
    setPartyId(''); setSelectedInvoiceId(''); setAmount(0); setMethod('bank'); setReference(''); setNotes('');
  };

  const handleSave = () => {
    if (!partyId || !selectedInvoiceId || amount <= 0) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    if (selectedInvoice && amount > selectedInvoice.balance) {
      toast({ title: 'Error', description: 'Amount cannot exceed balance', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      id: crypto.randomUUID(), invoiceId: selectedInvoiceId,
      invoiceType: mode === 'receipt' ? 'sales' : 'purchase',
      amount, date, method, reference, notes, createdAt: now,
    };

    addPayment(payment);

    const paymentAccountId = method === 'cash' ? 'acc-1000' : 'acc-1010';

    if (mode === 'receipt') {
      // Journal: Debit Cash/Bank, Credit A/R
      postTransactionEntry({
        date, reference: `REC-${payment.id.slice(0, 8)}`,
        referenceType: 'receipt', referenceId: payment.id,
        description: `Receipt from ${getClient(partyId)?.name}`,
        lines: [
          { accountId: paymentAccountId, debit: amount, credit: 0 },
          { accountId: 'acc-1100', debit: 0, credit: amount },
        ],
        idempotencyKey: `receipt:${payment.id}`,
      });

      const inv = invoices.find((i) => i.id === selectedInvoiceId);
      if (inv) {
        // Calculate new status based on total payments
        const paymentStatus = calculateInvoicePaymentStatus(selectedInvoiceId);
        // Keep the current status if it's "sent", otherwise update with payment status
        const newStatus = inv.status === 'sent' ? paymentStatus : paymentStatus;
        updateInvoice({ ...inv, status: newStatus as any, updatedAt: now });
      }
    } else {
      // Journal: Debit A/P, Credit Cash/Bank
      postTransactionEntry({
        date, reference: `PAY-${payment.id.slice(0, 8)}`,
        referenceType: 'payment', referenceId: payment.id,
        description: `Payment to ${getClient(partyId)?.name}`,
        lines: [
          { accountId: 'acc-2000', debit: amount, credit: 0 },
          { accountId: paymentAccountId, debit: 0, credit: amount },
        ],
        idempotencyKey: `payment:${payment.id}`,
      });

      const pi = purchaseInvoices.find((p) => p.id === selectedInvoiceId);
      if (pi) {
        // Calculate new status based on total payments
        const paymentStatus = calculateInvoicePaymentStatus(selectedInvoiceId);
        const newStatus = paymentStatus;
        updatePurchaseInvoice({ ...pi, status: newStatus as any, updatedAt: now });
      }
    }

    toast({ title: mode === 'receipt' ? 'Receipt recorded' : 'Payment recorded', description: `${currencySymbol}${amount.toLocaleString('en-IN')} recorded.` });
    resetForm();
  };

  return (
    <div className="space-y-3 pb-20 lg:pb-4 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Payments & Receipts</h1>
        <p className="text-xs text-muted-foreground">Record money in and money out</p>
      </div>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as any); resetForm(); }}>
        <TabsList className="w-full h-9">
          <TabsTrigger value="receipt" className="flex-1 text-xs gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5" />Receipt (Money In)
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex-1 text-xs gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5" />Payment (Money Out)
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">{mode === 'receipt' ? 'Receive Payment' : 'Make Payment'}</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{mode === 'receipt' ? 'Customer' : 'Vendor'} *</Label>
            <Select value={partyId} onValueChange={(v) => { setPartyId(v); setSelectedInvoiceId(''); setAmount(0); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder={`Select ${mode === 'receipt' ? 'customer' : 'vendor'}`} /></SelectTrigger>
              <SelectContent>
                {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {partyId && (
            <div className="space-y-1.5">
              <Label className="text-xs">{mode === 'receipt' ? 'Sales Invoice' : 'Purchase Invoice'} *</Label>
              <Select value={selectedInvoiceId} onValueChange={(v) => {
                setSelectedInvoiceId(v);
                const inv = mode === 'receipt' ? invoices.find((i) => i.id === v) : purchaseInvoices.find((p) => p.id === v);
                if (inv) {
                  const paid = payments.filter((p) => p.invoiceId === v).reduce((s, p) => s + p.amount, 0);
                  setAmount(inv.netTotal - paid);
                }
              }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {partyInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.number} — {currencySymbol}{inv.netTotal.toLocaleString('en-IN')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {partyInvoices.length === 0 && <p className="text-[10px] text-muted-foreground">No unpaid invoices for this party</p>}
            </div>
          )}

          {selectedInvoice && (
            <Card className="bg-muted/30">
              <CardContent className="p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[10px] text-muted-foreground uppercase">Total</p><p className="text-sm font-bold">{currencySymbol}{selectedInvoice.netTotal.toLocaleString('en-IN')}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Paid</p><p className="text-sm font-bold text-success">{currencySymbol}{selectedInvoice.paid.toLocaleString('en-IN')}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Balance</p><p className="text-sm font-bold text-destructive">{currencySymbol}{selectedInvoice.balance.toLocaleString('en-IN')}</p></div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedInvoiceId && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount ({currencySymbol}) *</Label>
                <Input type="number" min="0" max={selectedInvoice?.balance || 0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reference / Cheque No.</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={2} className="resize-none text-sm" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedInvoiceId && (
        <Button onClick={handleSave} className="w-full h-10">
          <Save className="mr-1.5 h-4 w-4" />{mode === 'receipt' ? 'Record Receipt' : 'Record Payment'}
        </Button>
      )}
    </div>
  );
}
