import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { currencySymbols, type PurchaseInvoice, type LineItem, type PurchaseInvoiceStatus } from '@/types';
import { Plus, Trash2, Save, ArrowLeft, Edit2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ItemPicker } from '@/components/ItemPicker';

export default function PurchaseInvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    purchaseInvoices, addPurchaseInvoice, updatePurchaseInvoice,
    getVendors, getClient, settings, generatePurchaseInvoiceNumber, postTransactionEntry, adjustItemStock,
  } = useApp();

  const isEditing = id && id !== 'new';
  const existing = isEditing ? purchaseInvoices.find((p) => p.id === id) : null;
  const currencySymbol = currencySymbols[settings.currency];
  const vendors = getVendors();

  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);

  const [vendorId, setVendorId] = useState(existing?.vendorId || '');
  const [dueDate, setDueDate] = useState(existing?.dueDate || defaultDueDate.toISOString().split('T')[0]);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [terms, setTerms] = useState(existing?.terms || '');
  const [items, setItems] = useState<LineItem[]>(
    existing?.items || [{ id: crypto.randomUUID(), name: '', description: '', quantity: 1, rate: 0, total: 0 }]
  );

  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isAddItemSheetOpen, setIsAddItemSheetOpen] = useState(false);
  const [tempItem, setTempItem] = useState<LineItem>({ id: '', name: '', description: '', quantity: 1, rate: 0, total: 0 });

  const netTotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
  const vatTotal = useMemo(() => items.reduce((sum, item) => sum + (item.vatAmount ?? 0), 0), [items]);
  const grandTotal = netTotal + vatTotal;
  const currentStatus = existing?.status || 'draft';

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'quantity' || field === 'rate') {
        item[field] = Number(value) || 0;
        item.total = item.quantity * item.rate;
        item.vatAmount = item.vatApplicable ? (item.total * (item.vatPercentage ?? 0)) / 100 : 0;
      }
      else { (item as any)[field] = value; }
      updated[index] = item;
      return updated;
    });
  };

  const selectItemForRow = (index: number, picked: { id: string; name: string; description?: string; rate: number; cost?: number; vatApplicable: boolean; vatPercentage: number; }) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[index];
      const qty = cur.quantity || 1;
      const rate = picked.cost ?? picked.rate;
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
    if (isMobile) { setTempItem({ id: crypto.randomUUID(), name: '', description: '', quantity: 1, rate: 0, total: 0 }); setIsAddItemSheetOpen(true); }
    else { setItems((prev) => [...prev, { id: crypto.randomUUID(), name: '', description: '', quantity: 1, rate: 0, total: 0 }]); }
  };

  const saveMobileItem = () => {
    if (!tempItem.name.trim()) { toast({ title: 'Error', description: 'Item name is required', variant: 'destructive' }); return; }
    const itemToSave = { ...tempItem, total: tempItem.quantity * tempItem.rate };
    if (editingItemIndex !== null) { setItems((prev) => { const u = [...prev]; u[editingItemIndex] = itemToSave; return u; }); setEditingItemIndex(null); }
    else { setItems((prev) => [...prev, itemToSave]); }
    setIsAddItemSheetOpen(false);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) { toast({ title: 'Cannot remove', description: 'At least one item is required.', variant: 'destructive' }); return; }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!vendorId) { toast({ title: 'Error', description: 'Please select a vendor', variant: 'destructive' }); return; }
    if (items.some((item) => !item.name.trim())) { toast({ title: 'Error', description: 'All items must have a name', variant: 'destructive' }); return; }

    const now = new Date().toISOString();
    if (isEditing && existing) {
      updatePurchaseInvoice({ ...existing, vendorId, items, netTotal: grandTotal, dueDate, notes, terms, updatedAt: now });
      toast({ title: 'Bill updated', description: `${existing.number} updated.` });
    } else {
      const pi: PurchaseInvoice = {
        id: crypto.randomUUID(), number: generatePurchaseInvoiceNumber(), vendorId,
        items, netTotal: grandTotal, status: 'draft', dueDate, notes, terms, createdAt: now, updatedAt: now,
      };
      addPurchaseInvoice(pi);

      // Increment stock for purchased items
      items.forEach((li) => { if (li.itemId) adjustItemStock(li.itemId, li.quantity); });

      postTransactionEntry({
        date: now,
        reference: pi.number,
        referenceType: 'purchase_invoice',
        referenceId: pi.id,
        description: `Purchase Invoice ${pi.number}`,
        lines: [
          { accountId: 'acc-5000', debit: netTotal, credit: 0 },
          ...(vatTotal > 0 ? [{ accountId: 'acc-1100', debit: vatTotal, credit: 0 }] : []),
          { accountId: 'acc-2000', debit: 0, credit: grandTotal },
        ],
        idempotencyKey: `purchase_invoice:${pi.id}:${pi.updatedAt}`,
      });

      toast({ title: 'Bill created', description: `${pi.number} created.` });
      navigate(`/purchases/${pi.id}`);
      return;
    }
  };

  useEffect(() => { if (isEditing && !existing) navigate('/purchases'); }, [isEditing, existing, navigate]);

  return (
    <div className="space-y-3 pb-24 lg:pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchases')} className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">{isEditing ? existing?.number : 'New Bill'}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">{isEditing ? 'Edit purchase invoice' : 'Create purchase invoice'}</p>
        </div>
        {isEditing && <Badge variant="outline" className="text-xs ml-1">{currentStatus}</Badge>}
      </div>

      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Vendor & Details</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Vendor *</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {vendors.length === 0 && <p className="text-[10px] text-muted-foreground">No vendors found. Add a vendor in Parties first.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-2.5 px-3">
          <CardTitle className="text-sm">Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs"><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left py-2 w-8">#</th><th className="text-left py-2">Item</th><th className="text-left py-2">Description</th><th className="text-right py-2 w-20">Qty</th><th className="text-right py-2 w-24">Rate</th><th className="text-right py-2 w-24">Total</th><th className="w-8"></th></tr></thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground">{index + 1}</td>
                    <td className="py-2 min-w-[180px]">
                      <ItemPicker
                        value={item.itemId}
                        fallbackName={item.name}
                        onSelect={(it) => selectItemForRow(index, it)}
                      />
                    </td>
                    <td className="py-2"><Input value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Description" className="h-8" /></td>
                    <td className="py-2"><Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="h-8 text-right" /></td>
                    <td className="py-2"><Input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(index, 'rate', e.target.value)} className="h-8 text-right" /></td>
                    <td className="py-2 text-right font-medium">{currencySymbol}{item.total.toLocaleString('en-IN')}</td>
                    <td className="py-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-2">
            {items.map((item, index) => (
              <div key={item.id} className="p-2.5 rounded-lg border bg-muted/30" onClick={() => { setEditingItemIndex(index); setTempItem({ ...items[index] }); setIsAddItemSheetOpen(true); }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.quantity} × {currencySymbol}{item.rate.toLocaleString('en-IN')}</p>
                  </div>
                  <p className="text-sm font-semibold">{currencySymbol}{item.total.toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <div className="w-full sm:w-64 rounded-lg bg-warning/10 p-2.5 space-y-1">
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>{currencySymbol}{netTotal.toLocaleString('en-IN')}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">VAT</span><span>{currencySymbol}{vatTotal.toLocaleString('en-IN')}</span></div>
              <div className="flex items-center justify-between text-sm font-bold pt-1 border-t"><span>Grand Total</span><span>{currencySymbol}{grandTotal.toLocaleString('en-IN')}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2.5 px-3"><CardTitle className="text-sm">Notes & Terms</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={2} className="resize-none text-sm" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Terms</Label><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Terms..." rows={2} className="resize-none text-sm" /></div>
        </CardContent>
      </Card>

      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:relative p-3 lg:p-0 bg-background border-t lg:border-0 z-30">
        <Button onClick={handleSave} variant="outline" size="sm" className="w-full h-9">
          <Save className="mr-1.5 h-4 w-4" />Save {isEditing ? 'Changes' : 'Draft'}
        </Button>
      </div>

      <Sheet open={isAddItemSheetOpen} onOpenChange={(open) => { setIsAddItemSheetOpen(open); if (!open) setEditingItemIndex(null); }}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh]">
          <SheetHeader className="text-left"><SheetTitle>{editingItemIndex !== null ? 'Edit Item' : 'Add Item'}</SheetTitle><SheetDescription>Item details</SheetDescription></SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="space-y-1.5"><Label className="text-xs">Item Name *</Label><Input value={tempItem.name} onChange={(e) => setTempItem({ ...tempItem, name: e.target.value })} className="h-10" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={tempItem.description} onChange={(e) => setTempItem({ ...tempItem, description: e.target.value })} className="h-10" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Quantity</Label><Input type="number" min="1" value={tempItem.quantity} onChange={(e) => setTempItem({ ...tempItem, quantity: Number(e.target.value) || 1 })} className="h-10" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Rate</Label><Input type="number" min="0" step="0.01" value={tempItem.rate} onChange={(e) => setTempItem({ ...tempItem, rate: Number(e.target.value) || 0 })} className="h-10" /></div>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            {editingItemIndex !== null && <Button variant="destructive" onClick={() => { removeItem(editingItemIndex); setIsAddItemSheetOpen(false); setEditingItemIndex(null); }} className="flex-1"><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button>}
            <Button onClick={saveMobileItem} className="flex-1"><Save className="mr-1.5 h-4 w-4" />{editingItemIndex !== null ? 'Update' : 'Add'}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
