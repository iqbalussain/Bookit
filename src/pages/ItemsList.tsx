import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import type { Item } from '@/types';
import { currencySymbols } from '@/types';

const emptyItem = (defaultVat: number, vatEnabled: boolean): Item => ({
  id: '', name: '', description: '', unit: 'pcs',
  rate: 0, cost: 0, stock: 0, reorderLevel: 0,
  vatApplicable: vatEnabled, vatPercentage: defaultVat,
  createdAt: new Date().toISOString(),
});

export default function ItemsList() {
  const { items, addItem, updateItem, deleteItem, settings } = useApp();
  const { toast } = useToast();
  const currencySymbol = currencySymbols[settings.currency];
  const defaultVat = settings.defaultVatPercentage ?? 5;
  const vatEnabled = settings.vatEnabled ?? true;

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<Item>(emptyItem(defaultVat, vatEnabled));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q));
  }, [items, search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyItem(defaultVat, vatEnabled));
    setOpen(true);
  };
  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({ ...item });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (editing) {
      updateItem({ ...form, id: editing.id });
      toast({ title: 'Item updated', description: form.name });
    } else {
      addItem({ ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      toast({ title: 'Item created', description: form.name });
    }
    setOpen(false);
  };

  const remove = (item: Item) => {
    if (!confirm(`Delete item "${item.name}"?`)) return;
    deleteItem(item.id);
    toast({ title: 'Item deleted', variant: 'destructive' });
  };

  return (
    <div className="space-y-3 pb-20 lg:pb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Items
          </h1>
          <p className="text-xs text-muted-foreground">Master list of products & services with VAT</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> New Item
        </Button>
      </div>

      <Card>
        <CardHeader className="py-2.5 px-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="h-8 border-0 shadow-none focus-visible:ring-0 px-0" />
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No items yet. Click "New Item" to start.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2">Item</th>
                    <th className="text-left py-2 hidden sm:table-cell">Unit</th>
                    <th className="text-right py-2">Rate</th>
                    <th className="text-right py-2 hidden md:table-cell">Cost</th>
                    <th className="text-right py-2">Stock</th>
                    <th className="text-right py-2">VAT</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="font-medium">{item.name}</div>
                        {item.description && <div className="text-[11px] text-muted-foreground">{item.description}</div>}
                      </td>
                      <td className="py-2 text-muted-foreground hidden sm:table-cell">{item.unit || '-'}</td>
                      <td className="py-2 text-right">{currencySymbol}{item.rate.toLocaleString('en-IN')}</td>
                      <td className="py-2 text-right hidden md:table-cell">{currencySymbol}{(item.cost ?? 0).toLocaleString('en-IN')}</td>
                      <td className="py-2 text-right">
                        <span className={item.reorderLevel && item.stock <= item.reorderLevel ? 'text-destructive font-semibold' : ''}>
                          {item.stock}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {item.vatApplicable ? (
                          <Badge variant="secondary" className="text-[10px]">{item.vatPercentage}%</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(item)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Item' : 'New Item'}</DialogTitle>
            <DialogDescription>Stored in the master item list. VAT applies on sales/purchases.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Item Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Laptop" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Input value={form.unit ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs / kg / hr" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Opening Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sale Rate ({currencySymbol})</Label>
                <Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) || 0 })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Purchase Cost ({currencySymbol})</Label>
                <Input type="number" step="0.01" value={form.cost ?? 0} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) || 0 })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Reorder Level</Label>
                <Input type="number" value={form.reorderLevel ?? 0} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) || 0 })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">VAT %</Label>
                <Input type="number" step="0.01" value={form.vatPercentage} onChange={(e) => setForm({ ...form, vatPercentage: Number(e.target.value) || 0 })} disabled={!form.vatApplicable} className="h-9" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2.5">
              <div>
                <Label className="text-xs">VAT Applicable</Label>
                <p className="text-[10px] text-muted-foreground">Charge VAT on this item</p>
              </div>
              <Switch checked={form.vatApplicable} onCheckedChange={(v) => setForm({ ...form, vatApplicable: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}