import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { currencySymbols, type QuotationStatus } from '@/types';
import { Plus, Search, FileText, Trash2, Edit, ArrowRight, ChevronDown, ChevronRight, Filter, CheckCircle } from 'lucide-react';

export default function QuotationsList() {
  const { quotations, deleteQuotation, getClient, getSalesman, settings } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const currencySymbol = currencySymbols[settings.currency];

  const filteredQuotations = quotations.filter((q) => {
    const client = getClient(q.clientId);
    const matchesSearch =
      q.number.toLowerCase().includes(search.toLowerCase()) ||
      client?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusDot = (status: QuotationStatus) => {
    const colors: Record<QuotationStatus, string> = {
      draft: 'bg-muted-foreground',
      sent: 'bg-primary',
      approved: 'bg-success',
      rejected: 'bg-destructive',
      converted: 'bg-primary',
    };
    return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Quotations</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Manage quotations and convert to invoices
          </p>
        </div>
        <Button asChild size="sm" className="hidden lg:flex">
          <Link to="/quotations/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New Quote
          </Link>
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
                <Filter className="h-4 w-4" />
                <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as QuotationStatus | 'all')}>
            <SelectTrigger className="w-[140px] h-9 hidden sm:flex">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent className="sm:hidden">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as QuotationStatus | 'all')}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {filteredQuotations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No quotations found</p>
            <p className="text-xs text-muted-foreground mb-3">
              {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first quotation'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button asChild size="sm">
                <Link to="/quotations/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create Quote
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredQuotations
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((quotation) => {
              const client = getClient(quotation.clientId);
              return (
                <Card key={quotation.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="hidden xs:flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate">{quotation.number}</p>
                          {getStatusDot(quotation.status)}
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {quotation.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{client?.name || 'No client'}</span>
                          <span>•</span>
                          <span className="truncate">{getSalesman(quotation.salesmanId || '')?.name || 'No salesman'}</span>
                          <span>•</span>
                          <span className="shrink-0">
                            {new Date(quotation.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold">
                          {currencySymbol}{quotation.netTotal.toLocaleString('en-IN')}
                        </span>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link to={`/quotations/${quotation.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
                                <AlertDialogDescription>Delete {quotation.number}? This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteQuotation(quotation.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {quotation.status === 'approved' && (
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <Link to={`/invoices/new?fromQuotation=${quotation.id}`}>
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {quotation.status === 'converted' && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-success" />
                            </span>
                          )}
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
