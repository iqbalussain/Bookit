import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Item } from '@/types';

interface Props {
  value?: string; // itemId
  fallbackName?: string; // for legacy items without itemId
  onSelect: (item: Item) => void;
  className?: string;
}

export function ItemPicker({ value, fallbackName, onSelect, className }: Props) {
  const { items, addItem, settings } = useApp();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const defaultVat = settings.defaultVatPercentage ?? 5;
  const vatEnabled = settings.vatEnabled ?? true;
  const [draft, setDraft] = useState({
    name: '', unit: 'pcs', rate: 0, cost: 0,
    vatApplicable: vatEnabled, vatPercentage: defaultVat,
  });

  const selected = items.find((i) => i.id === value);
  const label = selected?.name || fallbackName || 'Select item...';

  const handleCreate = () => {
    if (!draft.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    const newItem: Item = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      unit: draft.unit,
      rate: draft.rate,
      cost: draft.cost,
      stock: 0,
      vatApplicable: draft.vatApplicable,
      vatPercentage: draft.vatPercentage,
      createdAt: new Date().toISOString(),
    };
    addItem(newItem);
    onSelect(newItem);
    setCreatorOpen(false);
    setDraft({ name: '', unit: 'pcs', rate: 0, cost: 0, vatApplicable: vatEnabled, vatPercentage: defaultVat });
    toast({ title: 'Item created', description: newItem.name });
  };

  return (
    <div className={cn('flex gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 flex-1 justify-between text-xs font-normal"
          >
            <span className={cn('truncate', !selected && !fallbackName && 'text-muted-foreground')}>
              {label}
            </span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search item..." className="h-9" />
            <CommandList>
              <CommandEmpty>
                <div className="text-xs text-muted-foreground py-2">No items found.</div>
              </CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    className="text-xs"
                  >
                    <Check className={cn('mr-2 h-3.5 w-3.5', value === item.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.unit} • Rate: {item.rate}
                        {item.vatApplicable ? ` • VAT ${item.vatPercentage}%` : ''}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setCreatorOpen(true)}
        title="Create new item"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={creatorOpen} onOpenChange={setCreatorOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Quick Add Item</DialogTitle>
            <DialogDescription>Create a new item in the master list</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Item Name *</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Consulting hour" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rate</Label>
                <Input type="number" step="0.01" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) || 0 })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cost</Label>
                <Input type="number" step="0.01" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) || 0 })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">VAT %</Label>
                <Input type="number" step="0.01" value={draft.vatPercentage} onChange={(e) => setDraft({ ...draft, vatPercentage: Number(e.target.value) || 0 })} disabled={!draft.vatApplicable} className="h-9" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2.5">
              <Label className="text-xs">VAT Applicable</Label>
              <Switch checked={draft.vatApplicable} onCheckedChange={(v) => setDraft({ ...draft, vatApplicable: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreatorOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate}>Create & Select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}