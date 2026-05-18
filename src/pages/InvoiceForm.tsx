import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { currencySymbols, type Invoice, type LineItem, type InvoiceStatus, type Client } from '@/types';
import { Plus, Trash2, Save, ArrowLeft, Send, Download, Share2, Edit2, CreditCard } from 'lucide-react';
import { generatePDF, shareViaWhatsApp } from '@/lib/documentUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ItemPicker } from '@/components/ItemPicker';

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    invoices, addInvoice, updateInvoice,
    quotations, updateQuotation,
    clients, addClient, getClient, settings,
    generateInvoiceNumber,
    postSalesInvoice, repostSalesInvoice, adjustItemStock, calculateInvoicePaymentStatus,
    salesmen, addSalesman,
  } = useApp();

  const isEditing = id && id !== 'new';
  const existingInvoice = isEditing ? invoices.find((i) => i.id === id) : null;
  const fromQuotationId = searchParams.get('fromQuotation');
  const sourceQuotation = fromQuotationId ? quotations.find((q) => q.id === fromQuotationId) : null;
  const currencySymbol = currencySymbols[settings.currency];

  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);

  const [clientId, setClientId] = useState(existingInvoice?.clientId || sourceQuotation?.clientId || '');
  const [salesmanId, setSalesmanId] = useState<string>(existingInvoice?.salesmanId || sourceQuotation?.salesmanId || '');
  const [dueDate, setDueDate] = useState(existingInvoice?.dueDate || defaultDueDate.toISOString().split('T')[0]);
  const [notes, setNotes] = useState(existingInvoice?.notes || sourceQuotation?.notes || '');
  const [terms, setTerms] = useState(existingInvoice?.terms || sourceQuotation?.terms || 'Payment terms: Net 30 days');
  const [items, setItems] = useState<LineItem[]>(
    existingInvoice?.items || sourceQuotation?.items || [{ id: crypto.randomUUID(), name: '', description: '', quantity: 1, rate: 0, total: 0 }]
  );

  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [isAddSalesmanOpen, setIsAddSalesmanOpen] = useState(false);
  const [newSalesman, setNewSalesman] = useState({ name: '', phone: '' });
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isAddItemSheetOpen, setIsAddItemSheetOpen] = useState(false);
  const [tempItem, setTempItem] = useState<LineItem>({ id: '', name: '', description: '', quantity: 1, rate: 0, total: 0 });

  const netTotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
  const vatTotal = useMemo(() => items.reduce((sum, item) => sum + (item.vatAmount ?? 0), 0), [items]);
  const grandTotal = netTotal + vatTotal;
  // Calculate displayed status based on payment records
  const displayedStatus: InvoiceStatus | 'draft' = existingInvoice ? calculateInvoicePaymentStatus(existingInvoice.id) : 'draft';
  const currentStatus: InvoiceStatus = existingInvoice?.status === 'draft' 
    ? 'draft' 
    : existingInvoice?.status === 'cancelled'
    ? 'cancelled'
    : displayedStatus;

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'quantity' || field === 'rate') {
        item[field] = Number(value) || 0;
        item.total = item.quantity * item.rate;
        item.vatAmount = item.vatApplicable ? (item.total * (item.vatPercentage ?? 0)) / 100 : 0;
      } else { (item as any)[field] = value; }
      updated[index] = item;
      return updated;
    });
  };

  const selectItemForRow = (index: number, picked: { id: string; name: string; description?: string; rate: number; vatApplicable: boolean; vatPercentage: number; }) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[index];
      const qty = cur.quantity || 1;
      const rate = picked.rate;
      const total = qty * rate;
      const vatAmount = picked.vatApplicable ? (total * picked.vatPercentage) / 100 : 0;
      updated[index] = {
        ...cur,
        itemId: picked.id,
        name: picked.name,
        description: picked.description ?? cur.description,
        rate,
        total,
        vatApplicable: picked.vatApplicable,
        vatPercentage: picked.vatPercentage,
        vatAmount,
      };
      return updated;
    });
  };

  const addItem = () => {
    if (isMobile) {
      setTempItem({ id: crypto.randomUUID(), name: '', description: '', quantity: 1, rate: 0, total: 0 });
      setIsAddItemSheetOpen(true);
    } else {
      setItems((prev) => [...prev, { id: crypto.randomUUID(), name: '', description: '', quantity: 1, rate: 0, total: 0 }]);
    }
  };

  const saveMobileItem = () => {
    if (!tempItem.name.trim()) { toast({ title: 'Error', description: 'Item name is required', variant: 'destructive' }); return; }
    const itemToSave = { ...tempItem, total: tempItem.quantity * tempItem.rate };
    if (editingItemIndex !== null) {
      setItems((prev) => { const updated = [...prev]; updated[editingItemIndex] = itemToSave; return updated; });
      setEditingItemIndex(null);
    } else { setItems((prev) => [...prev, itemToSave]); }
    setIsAddItemSheetOpen(false);
    setTempItem({ id: '', name: '', description: '', quantity: 1, rate: 0, total: 0 });
  };

  const editItemMobile = (index: number) => { setEditingItemIndex(index); setTempItem({ ...items[index] }); setIsAddItemSheetOpen(true); };

  const removeItem = (index: number) => {
    if (items.length === 1) { toast({ title: 'Cannot remove', description: 'At least one item is required.', variant: 'destructive' }); return; }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddClient = () => {
    if (!newClient.name.trim()) { toast({ title: 'Error', description: 'Client name is required', variant: 'destructive' }); return; }
    const client: Client = { id: crypto.randomUUID(), ...newClient, type: 'customer', createdAt: new Date().toISOString() };
    addClient(client);
    setClientId(client.id);
    setIsAddClientOpen(false);
    setNewClient({ name: '', email: '', phone: '', address: '' });
    toast({ title: 'Client added', description: `${client.name} has been added.` });
  };

  const handleSave = () => {
    if (!clientId) { toast({ title: 'Error', description: 'Please select a client', variant: 'destructive' }); return; }
    if (!salesmanId) { toast({ title: 'Error', description: 'Please select a salesman', variant: 'destructive' }); return; }
    if (items.some((item) => !item.name.trim())) { toast({ title: 'Error', description: 'All items must have a name', variant: 'destructive' }); return; }

    const now = new Date().toISOString();

    if (isEditing && existingInvoice) {
      const updated: Invoice = {
        ...existingInvoice,
        clientId,
        items,
        netTotal: grandTotal,
        dueDate,
        notes,
        terms,
        salesmanId,
        updatedAt: now,
      };

      try {
        updateInvoice(updated);
        repostSalesInvoice(existingInvoice, updated);
      } catch (err) {
        updateInvoice(existingInvoice);
        toast({ title: 'Invoice update failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
        return;
      }

      toast({ title: 'Invoice updated', description: `${existingInvoice.number} has been updated.` });
    } else {
      const newInvoice: Invoice = {
        id: crypto.randomUUID(), number: generateInvoiceNumber(), clientId,
          quotationId: sourceQuotation?.id, items, netTotal: grandTotal, status: 'draft', dueDate, notes, terms, salesmanId,
          createdAt: now, updatedAt: now,
      };
      addInvoice(newInvoice);

      // Decrement stock for each item that has an itemId
      items.forEach((li) => { if (li.itemId) adjustItemStock(li.itemId, -li.quantity); });

      // Mark source quotation as converted
      if (sourceQuotation) {
        updateQuotation({ ...sourceQuotation, status: 'converted', convertedInvoiceId: newInvoice.id, updatedAt: now });
      }

      // Post journal using the shared posting service
      try {
        postSalesInvoice(newInvoice);
      } catch (err) {
        console.error('[InvoiceForm] Journal entry failed:', err);
        toast({ title: 'Journal entry failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      }

      toast({ title: 'Invoice created', description: `${newInvoice.number} has been created.` });
      navigate(`/invoices/${newInvoice.id}`);
      return;
    }
  };

  const handleMarkAsSent = () => {
    if (!existingInvoice) return;
    const now = new Date().toISOString();
    updateInvoice({ ...existingInvoice, status: 'sent', updatedAt: now });
    toast({ title: 'Invoice sent', description: `${existingInvoice.number} marked as sent.` });
  };

  const handleDownloadPDF = async () => {
    if (!existingInvoice) return;
    const client = getClient(clientId);
    try {
      await generatePDF({ type: 'invoice', document: existingInvoice, client, settings});
      toast({ title: 'PDF downloaded successfully' });
    } catch (err) {
      toast({ title: 'PDF generation failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const handleShare = () => {
    if (!existingInvoice) return;
    const client = getClient(clientId);
    shareViaWhatsApp({ type: 'invoice', document: existingInvoice, client, settings });
  };

  useEffect(() => { if (isEditing && !existingInvoice) navigate('/invoices'); }, [isEditing, existingInvoice, navigate]);

  const statusColors: Record<InvoiceStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-primary/10 text-primary',
    paid: 'bg-success/10 text-success',
    partial: 'bg-warning/10 text-warning',
    overdue: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-3 pb-24 lg:pb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')} className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight truncate">
              {isEditing ? existingInvoice?.number : 'New Invoice'}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block truncate">
              {sourceQuotation ? `From ${sourceQuotation.number}` : isEditing ? 'Edit invoice' : 'Create invoice'}
            </p>
          </div>
          {isEditing && (
            <Badge variant="outline" className={`${statusColors[currentStatus]} text-xs ml-1`}>
              {currentStatus}
            </Badge>
          )}
        </div>
        {isEditing && (
          <div className="flex gap-1.5 shrink-0">
            {(currentStatus === 'partial' || (existingInvoice?.status === 'sent' && currentStatus !== 'paid')) && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${id}/payment`)} className="h-8 px-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline ml-1.5">Payment</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="h-8 px-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} className="h-8 px-2">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Share</span>
            </Button>
          </div>
        )}
      </div>

      {/* Client & Due Date (no status dropdown) */}
      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Client & Details</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client *</Label>
              <div className="flex gap-1.5">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setIsAddClientOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Salesman *</Label>
              <div className="flex gap-1.5">
                <Select value={salesmanId} onValueChange={setSalesmanId}>
                  <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Select salesman" /></SelectTrigger>
                  <SelectContent>
                    {salesmen.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setIsAddSalesmanOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-2.5 px-3">
          <CardTitle className="text-sm">Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" />Add
          </Button>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 w-8">S.No</th><th className="text-left py-2">Description</th>
                  <th className="text-right py-2 w-20">Qty</th><th className="text-right py-2 w-24">Rate</th><th className="text-right py-2 w-24">Amount</th><th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground">{index + 1}</td>
                    <td className="py-2 min-w-[180px]">
                      <div className="space-y-1">
                        <ItemPicker
                          value={item.itemId}
                          fallbackName={item.name}
                          onSelect={(it) => selectItemForRow(index, it)}
                        />
                        <Textarea value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Description (supports multiline/bullets)" rows={2} className="text-sm" />
                      </div>
                    </td>
                    <td className="py-2"><Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="h-8 text-right" /></td>
                    <td className="py-2"><Input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(index, 'rate', e.target.value)} className="h-8 text-right" /></td>
                    <td className="py-2 text-right font-medium">{currencySymbol}{(item.total + (item.vatApplicable ? (item.vatAmount ?? 0) : 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-2">
            {items.map((item, index) => (
              <div key={item.id} className="p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors" onClick={() => editItemMobile(index)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{index + 1}.</span><p className="text-sm font-medium truncate">{item.name || 'Untitled item'}</p></div>
                    {item.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{item.quantity} × {currencySymbol}{item.rate.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-right shrink-0"><p className="text-sm font-semibold">{currencySymbol}{item.total.toLocaleString('en-IN')}</p><Edit2 className="h-3.5 w-3.5 text-muted-foreground mt-1 ml-auto" /></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <div className="w-full sm:w-64 rounded-lg bg-primary/10 p-2.5 space-y-1">
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>{currencySymbol}{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">VAT</span><span>{currencySymbol}{vatTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Total After VAT</span><span>{currencySymbol}{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex items-center justify-between text-sm font-bold pt-1 border-t"><span>Grand Total</span><span>{currencySymbol}{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Notes & Terms</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div className="space-y-1.5"><Label htmlFor="notes" className="text-xs">Notes</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for client..." rows={2} className="resize-none text-sm" /></div>
          <div className="space-y-1.5"><Label htmlFor="terms" className="text-xs">Terms & Conditions</Label><Textarea id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms..." rows={2} className="resize-none text-sm" /></div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:relative p-3 lg:p-0 bg-background border-t lg:border-0 z-30">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-2 sm:justify-between lg:max-w-none">
          <div className="flex gap-2">
            {currentStatus === 'draft' && isEditing && (
              <Button onClick={handleMarkAsSent} size="sm" className="flex-1 sm:flex-none h-9">
                <Send className="mr-1.5 h-4 w-4" />Mark as Sent
              </Button>
            )}
            {(currentStatus === 'partial' || (existingInvoice?.status === 'sent' && currentStatus !== 'paid')) && isEditing && (
              <Button onClick={() => navigate(`/invoices/${id}/payment`)} size="sm" className="flex-1 sm:flex-none h-9">
                <CreditCard className="mr-1.5 h-4 w-4" />Record Payment
              </Button>
            )}
          </div>
          {currentStatus === 'draft' && (
            <Button onClick={handleSave} variant="outline" size="sm" className="h-9">
              <Save className="mr-1.5 h-4 w-4" />Save {isEditing ? 'Changes' : 'Draft'}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Item Sheet */}
      <Sheet open={isAddItemSheetOpen} onOpenChange={(open) => { setIsAddItemSheetOpen(open); if (!open) { setEditingItemIndex(null); setTempItem({ id: '', name: '', description: '', quantity: 1, rate: 0, total: 0 }); } }}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh]">
          <SheetHeader className="text-left"><SheetTitle>{editingItemIndex !== null ? 'Edit Item' : 'Add Item'}</SheetTitle><SheetDescription>{editingItemIndex !== null ? 'Update item details' : 'Add a new line item'}</SheetDescription></SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="space-y-1.5"><Label className="text-xs">Item Name *</Label><Input value={tempItem.name} onChange={(e) => setTempItem({ ...tempItem, name: e.target.value })} placeholder="Item name" className="h-10" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={tempItem.description} onChange={(e) => setTempItem({ ...tempItem, description: e.target.value })} placeholder="Description" className="h-10" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Quantity</Label><Input type="number" min="1" value={tempItem.quantity} onChange={(e) => setTempItem({ ...tempItem, quantity: Number(e.target.value) || 1 })} className="h-10" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Rate ({currencySymbol})</Label><Input type="number" min="0" step="0.01" value={tempItem.rate} onChange={(e) => setTempItem({ ...tempItem, rate: Number(e.target.value) || 0 })} className="h-10" /></div>
            </div>
            <div className="rounded-lg bg-muted p-3"><div className="flex justify-between text-sm font-medium"><span>Total</span><span>{currencySymbol}{(tempItem.quantity * tempItem.rate).toLocaleString('en-IN')}</span></div></div>
          </div>
          <div className="flex gap-2 mt-6">
            {editingItemIndex !== null && (<Button variant="destructive" onClick={() => { removeItem(editingItemIndex); setIsAddItemSheetOpen(false); setEditingItemIndex(null); }} className="flex-1"><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button>)}
            <Button onClick={saveMobileItem} className="flex-1"><Save className="mr-1.5 h-4 w-4" />{editingItemIndex !== null ? 'Update' : 'Add'}</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Add New Client</DialogTitle><DialogDescription>Quick add a new client</DialogDescription></DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="space-y-1.5"><Label htmlFor="clientName" className="text-xs">Name *</Label><Input id="clientName" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Client name" className="h-9" /></div>
            <div className="space-y-1.5"><Label htmlFor="clientEmail" className="text-xs">Email</Label><Input id="clientEmail" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="email@example.com" className="h-9" /></div>
            <div className="space-y-1.5"><Label htmlFor="clientPhone" className="text-xs">Phone</Label><Input id="clientPhone" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="+91 98765 43210" className="h-9" /></div>
            <div className="space-y-1.5"><Label htmlFor="clientAddress" className="text-xs">Address</Label><Input id="clientAddress" value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} placeholder="Address" className="h-9" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddClientOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddClient}>Add Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isAddSalesmanOpen} onOpenChange={setIsAddSalesmanOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Salesman</DialogTitle>
            <DialogDescription>Quick add a new salesman</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="space-y-1.5"><Label className="text-xs">Name *</Label><Input value={newSalesman.name} onChange={(e) => setNewSalesman({ ...newSalesman, name: e.target.value })} className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input value={newSalesman.phone} onChange={(e) => setNewSalesman({ ...newSalesman, phone: e.target.value })} className="h-9" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddSalesmanOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => {
              if (!newSalesman.name.trim()) return toast({ title: 'Error', description: 'Salesman name required', variant: 'destructive' });
              const s = { id: crypto.randomUUID(), name: newSalesman.name, phone: newSalesman.phone, createdAt: new Date().toISOString() };
              addSalesman(s);
              setSalesmanId(s.id);
              setIsAddSalesmanOpen(false);
              setNewSalesman({ name: '', phone: '' });
              toast({ title: 'Salesman added', description: `${s.name} created.` });
            }}>Add Salesman</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
