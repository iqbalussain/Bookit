import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { currencySymbols, type InvoiceStatus } from '@/types';
import { Plus, Search, Receipt, Trash2, Edit, ChevronDown, Filter } from 'lucide-react';

export default function InvoicesList() {
  const { invoices, payments, deleteInvoice, getClient, getSalesman, settings } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const currencySymbol = currencySymbols[settings.currency];

  // Single pass: invoiceId -> total paid. Avoids O(N*M) scan on every render.
  const paidByInvoice = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      map.set(p.invoiceId, (map.get(p.invoiceId) ?? 0) + p.amount);
    }
    return map;
  }, [payments]);

  const now = useMemo(() => Date.now(), []);

  const getDisplayStatus = (status: InvoiceStatus, invoiceId: string, dueDate: string, total: number): InvoiceStatus => {
    if (status === 'draft' || status === 'cancelled') return status;
    const paid = paidByInvoice.get(invoiceId) ?? 0;
    if (paid >= total && total > 0) return 'paid';
    if (paid > 0) return 'partial';
    return new Date(dueDate).getTime() < now ? 'overdue' : 'sent';
  };

  const searchLower = search.toLowerCase();
  const filteredInvoices = useMemo(() => invoices.filter((i) => {
    const client = getClient(i.clientId);
    const matchesSearch = i.number.toLowerCase().includes(searchLower) || client?.name.toLowerCase().includes(searchLower);
    const displayStatus = getDisplayStatus(i.status, i.id, i.dueDate, i.netTotal);
    const matchesStatus = statusFilter === 'all' || displayStatus === statusFilter;
    return matchesSearch && matchesStatus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [invoices, searchLower, statusFilter, paidByInvoice]);

  const sortedInvoices = useMemo(
    () => [...filteredInvoices].sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true })),
    [filteredInvoices],
  );

  const getStatusDot = (status: InvoiceStatus) => {
    const colors: Record<InvoiceStatus, string> = {
      draft: 'bg-muted-foreground',
      sent: 'bg-primary',
      paid: 'bg-success',
      partial: 'bg-warning',
      overdue: 'bg-destructive',
      cancelled: 'bg-muted-foreground',
    };
    return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sales Invoices</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Manage invoices and track payments</p>
        </div>
        <Button asChild size="sm" className="hidden lg:flex">
          <Link to="/invoices/new"><Plus className="mr-1.5 h-4 w-4" />New Invoice</Link>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 sm:hidden">
                <Filter className="h-4 w-4" /><ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InvoiceStatus | 'all')}>
            <SelectTrigger className="w-[140px] h-9 hidden sm:flex"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent className="sm:hidden">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InvoiceStatus | 'all')}>
              <SelectTrigger className="w-full h-9"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {sortedInvoices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No invoices found</p>
            <p className="text-xs text-muted-foreground mb-3">{search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice'}</p>
            {!search && statusFilter === 'all' && (
              <Button asChild size="sm"><Link to="/invoices/new"><Plus className="mr-1.5 h-4 w-4" />Create Invoice</Link></Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedInvoices.map((invoice) => {
              const client = getClient(invoice.clientId);
              const displayStatus = getDisplayStatus(invoice.status, invoice.id, invoice.dueDate, invoice.netTotal);
              return (
                <Card key={invoice.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="hidden xs:flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate">{invoice.number}</p>
                          {getStatusDot(displayStatus)}
                          <span className="text-[10px] text-muted-foreground capitalize">{displayStatus}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{client?.name || 'No client'}</span>
                          <span>•</span>
                          <span className="truncate">{getSalesman(invoice.salesmanId || '')?.name || 'No salesman'}</span>
                          <span>•</span>
                          <span className="shrink-0">Due {new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold">{currencySymbol}{invoice.netTotal.toLocaleString('en-IN')}</span>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8"><Link to={`/invoices/${invoice.id}`}><Edit className="h-4 w-4" /></Link></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Invoice</AlertDialogTitle><AlertDialogDescription>Delete {invoice.number}? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteInvoice(invoice.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
