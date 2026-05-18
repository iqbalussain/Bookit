import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { Client, PartyType } from '@/types';
import { Plus, Search, Users, Trash2, Edit, Phone, Mail, MapPin, ChevronRight, FileText } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ClientsList() {
  const { clients, addClient, updateClient, deleteClient } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | PartyType>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '',
    type: 'customer' as PartyType,
    paymentTermsDays: '',
    taxRegistrationNumber: '',
    creditLimit: '',
  });

  const filteredClients = clients.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchesType = typeFilter === 'all' || c.type === typeFilter || (typeFilter !== 'both' && c.type === 'both');
    return matchesSearch && matchesType;
  });

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', address: '', type: 'customer', paymentTermsDays: '', taxRegistrationNumber: '', creditLimit: '' });
    setEditingClient(null);
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name, email: client.email, phone: client.phone, address: client.address,
        type: client.type || 'customer',
        paymentTermsDays: client.paymentTermsDays?.toString() || '',
        taxRegistrationNumber: client.taxRegistrationNumber || '',
        creditLimit: client.creditLimit?.toString() || '',
      });
    } else { resetForm(); }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast({ title: 'Error', description: 'Client name is required', variant: 'destructive' }); return; }

    const clientData = {
      name: formData.name, email: formData.email, phone: formData.phone, address: formData.address,
      type: formData.type,
      paymentTermsDays: formData.paymentTermsDays ? Number(formData.paymentTermsDays) : undefined,
      taxRegistrationNumber: formData.taxRegistrationNumber || undefined,
      creditLimit: formData.creditLimit ? Number(formData.creditLimit) : undefined,
    };

    if (editingClient) {
      updateClient({ ...editingClient, ...clientData });
      toast({ title: 'Client updated', description: `${formData.name} has been updated.` });
    } else {
      const newClient: Client = { id: crypto.randomUUID(), ...clientData, createdAt: new Date().toISOString() };
      addClient(newClient);
      toast({ title: 'Client added', description: `${formData.name} has been added.` });
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const getAvatarColor = (name: string) => {
    const colors = ['bg-primary/10 text-primary', 'bg-success/10 text-success', 'bg-warning/10 text-warning', 'bg-destructive/10 text-destructive', 'bg-accent text-accent-foreground'];
    return colors[name.charCodeAt(0) % colors.length];
  };
  const typeLabel = (type: PartyType) => type === 'customer' ? 'Customer' : type === 'vendor' ? 'Vendor' : 'Both';
  const typeBadgeColor = (type: PartyType) => type === 'customer' ? 'bg-primary/10 text-primary' : type === 'vendor' ? 'bg-warning/10 text-warning' : 'bg-accent text-accent-foreground';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Parties</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Customers & Vendors</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Add Party</span><span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingClient ? 'Edit Party' : 'Add New Party'}</DialogTitle>
                <DialogDescription>{editingClient ? 'Update party details' : 'Enter new party details'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="space-y-2">
                  <Label className="text-xs">Party Type *</Label>
                  <RadioGroup value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as PartyType })} className="flex gap-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="customer" id="customer" /><Label htmlFor="customer" className="text-xs">Customer</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="vendor" id="vendor" /><Label htmlFor="vendor" className="text-xs">Vendor</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" /><Label htmlFor="both" className="text-xs">Both</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Name *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Party name" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="email" className="text-xs">Email</Label><Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" className="h-9" /></div>
                  <div className="space-y-1.5"><Label htmlFor="phone" className="text-xs">Phone</Label><Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+968 1234 5678" className="h-9" /></div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="address" className="text-xs">Address</Label><Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Full address" className="h-9" /></div>
                
                {/* Vendor fields */}
                {(formData.type === 'vendor' || formData.type === 'both') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Payment Terms (days)</Label><Input type="number" value={formData.paymentTermsDays} onChange={(e) => setFormData({ ...formData, paymentTermsDays: e.target.value })} placeholder="30" className="h-9" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Tax Reg. No.</Label><Input value={formData.taxRegistrationNumber} onChange={(e) => setFormData({ ...formData, taxRegistrationNumber: e.target.value })} placeholder="VAT/GST" className="h-9" /></div>
                  </div>
                )}
                {/* Customer fields */}
                {(formData.type === 'customer' || formData.type === 'both') && (
                  <div className="space-y-1.5"><Label className="text-xs">Credit Limit</Label><Input type="number" value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })} placeholder="0.00" className="h-9" /></div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">{editingClient ? 'Update' : 'Add'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Type tabs */}
      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)} className="w-full">
        <TabsList className="h-8 w-full">
          <TabsTrigger value="all" className="text-xs flex-1">All</TabsTrigger>
          <TabsTrigger value="customer" className="text-xs flex-1">Customers</TabsTrigger>
          <TabsTrigger value="vendor" className="text-xs flex-1">Vendors</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search parties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
      </div>

      {filteredClients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No parties found</p>
            <p className="text-xs text-muted-foreground mb-3">{search ? 'Try adjusting your search' : 'Add your first party'}</p>
            {!search && <Button onClick={() => handleOpenDialog()} size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Party</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filteredClients.sort((a, b) => a.name.localeCompare(b.name)).map((client) => (
            <Card key={client.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => isMobile && setSelectedClient(client)}>
              <CardContent className="p-2.5 sm:p-3">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold shrink-0 ${getAvatarColor(client.name)}`}>
                    {getInitials(client.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${typeBadgeColor(client.type || 'customer')}`}>
                        {typeLabel(client.type || 'customer')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{client.phone || client.email || 'No contact info'}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View Statement" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${client.id}/statement`); }}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    {client.phone && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.open(`tel:${client.phone}`); }}><Phone className="h-4 w-4" /></Button>}
                    {client.email && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.open(`mailto:${client.email}`); }}><Mail className="h-4 w-4" /></Button>}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenDialog(client); }}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Party</AlertDialogTitle><AlertDialogDescription>Delete {client.name}? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { try { deleteClient(client.id); } catch (err) { toast({ title: "Cannot delete client", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground sm:hidden" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          {selectedClient && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold ${getAvatarColor(selectedClient.name)}`}>
                    {getInitials(selectedClient.name)}
                  </div>
                  <div>
                    <SheetTitle>{selectedClient.name}</SheetTitle>
                    <SheetDescription>
                      <Badge variant="outline" className={`text-[10px] ${typeBadgeColor(selectedClient.type || 'customer')}`}>
                        {typeLabel(selectedClient.type || 'customer')}
                      </Badge>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="space-y-3 mt-4">
                {selectedClient.email && <a href={`mailto:${selectedClient.email}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"><Mail className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{selectedClient.email}</span></a>}
                {selectedClient.phone && <a href={`tel:${selectedClient.phone}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"><Phone className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{selectedClient.phone}</span></a>}
                {selectedClient.address && <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"><MapPin className="h-5 w-5 text-muted-foreground shrink-0" /><span className="text-sm">{selectedClient.address}</span></div>}
              </div>
              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => { setSelectedClient(null); navigate(`/clients/${selectedClient.id}/statement`); }}>
                  <FileText className="mr-2 h-4 w-4" />Statement
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => { setSelectedClient(null); handleOpenDialog(selectedClient); }}>
                  <Edit className="mr-2 h-4 w-4" />Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="destructive" className="flex-1"><Trash2 className="mr-2 h-4 w-4" />Delete</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete Party</AlertDialogTitle><AlertDialogDescription>Delete {selectedClient.name}? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { try { deleteClient(selectedClient.id); setSelectedClient(null); } catch (err) { toast({ title: "Cannot delete client", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
