import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  currencySymbols,
  type Client,
  type DiscountType,
  type Invoice,
  type InvoiceStatus,
  type InvoiceApprovalStatus,
  type InvoiceType,
  type LineItem,
  type Project,
  type ProjectInvoiceSummary,
} from '@/types';
import { Plus, Trash2, Save, ArrowLeft, Send, Download, Share2, CreditCard, AlertTriangle, Calculator } from 'lucide-react';
import { generatePDF, shareViaWhatsApp } from '@/lib/documentUtils';
import { ItemPicker } from '@/components/ItemPicker';
import { safeRandomUUID } from '@/lib/uuid';
import { useDelayedMissingRedirect } from '@/hooks/useDelayedMissingRedirect';

const formatPercent = (value: number) => `${value.toFixed(2).replace(/\.00$/, '')}%`;
const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

const createNormalItem = (): LineItem => ({
  id: safeRandomUUID(),
  name: '',
  description: '',
  quantity: 1,
  rate: 0,
  total: 0,
});

const createProjectItem = (): LineItem => ({
  id: safeRandomUUID(),
  name: '',
  description: '',
  quantity: 1,
  rate: 0,
  total: 0,
  activityId: '',
  completionPercentage: 0,
});

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    invoices, addInvoice, updateInvoice,
    quotations, updateQuotation,
    clients, addClient, getClient, settings,
    postSalesInvoice, repostSalesInvoice, adjustItemStock, calculateInvoicePaymentStatus,
    salesmen, addSalesman,
    projects,
  } = useApp();

  const isEditing = id && id !== 'new';
  const existingInvoice = isEditing ? invoices.find((i) => i.id === id) : null;
  const fromQuotationId = searchParams.get('fromQuotation');
  const sourceQuotation = fromQuotationId ? quotations.find((q) => q.id === fromQuotationId) : null;
  const currencySymbol = currencySymbols[settings.currency];

  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);
  
  const currentYear = new Date().getFullYear().toString();
  const mitcPrefix = `MITC/${currentYear}/`;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings?.currency || 'USD'
    }).format(amount);
  };

  const initialInvNumParts = (existingInvoice?.number || '').split(mitcPrefix);
  const defaultCustomNum = isEditing && initialInvNumParts.length > 1 ? initialInvNumParts[1] : '';

  const [invoiceNumberPart, setInvoiceNumberPart] = useState(defaultCustomNum);
  const [clientId, setClientId] = useState(existingInvoice?.clientId || sourceQuotation?.clientId || '');
  const [salesmanId, setSalesmanId] = useState<string>(existingInvoice?.salesmanId || sourceQuotation?.salesmanId || '');
  const [dueDate, setDueDate] = useState(existingInvoice?.dueDate || defaultDueDate.toISOString().split('T')[0]);
  const [notes, setNotes] = useState(existingInvoice?.notes || sourceQuotation?.notes || '');
  const [terms, setTerms] = useState(existingInvoice?.terms || sourceQuotation?.terms || 'Payment terms: Net 30 days');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(existingInvoice?.invoiceType || 'normal');
  const [discountType, setDiscountType] = useState<DiscountType>(existingInvoice?.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(existingInvoice?.discountValue || 0);
  const [projectId, setProjectId] = useState(existingInvoice?.projectId || '');
  const [approvalStatus, setApprovalStatus] = useState<InvoiceApprovalStatus>(existingInvoice?.approvalStatus || 'pending');
  const [vatEnabled, setVatEnabled] = useState(true);

  const [items, setItems] = useState<LineItem[]>(
    existingInvoice?.items?.length
      ? existingInvoice.items
      : sourceQuotation?.items?.length
        ? sourceQuotation.items
        : [createNormalItem()]
  );

  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [isAddSalesmanOpen, setIsAddSalesmanOpen] = useState(false);
  const [newSalesman, setNewSalesman] = useState({ name: '', phone: '' });

  const selectedProject = projects.find(p => p.id === projectId);
  const projectActivities = selectedProject?.activities || [];

  const completedValuationProjects = projects.filter(p => p.valuationCompleted);

  // Auto-set client when project selected
  useEffect(() => {
    if (invoiceType === 'project' && selectedProject && !isEditing) {
      setClientId(selectedProject.customerId || selectedProject.vendorId);
    }
  }, [projectId, invoiceType, selectedProject, isEditing]);

  const normalSubtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.total) || 0), 0), [items]);
  const vatTotal = useMemo(() => {
    if (!vatEnabled) return 0;
    if (invoiceType === 'project') {
      const sub = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      return roundMoney(sub * 0.05); // Assuming 5% standard VAT, can use settings.defaultVatPercentage
    }
    return items.reduce((sum, item) => sum + (item.vatApplicable ? Number(item.vatAmount) || 0 : 0), 0);
  }, [items, vatEnabled, invoiceType]);

  const discountAmount = useMemo(() => {
    if (invoiceType !== 'normal') return 0;
    const safeValue = Math.max(0, Number(discountValue) || 0);
    return discountType === 'percentage'
      ? Math.min(normalSubtotal, (normalSubtotal * safeValue) / 100)
      : Math.min(normalSubtotal, safeValue);
  }, [discountType, discountValue, invoiceType, normalSubtotal]);
  
  const normalGrandTotal = Math.max(0, normalSubtotal - discountAmount + vatTotal);

  const projectInvoiceAmount = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
    [items]
  );
  const currentProjectPercentage = selectedProject?.totalValue ? (projectInvoiceAmount / selectedProject.totalValue) * 100 : 0;
  
  const previousProjectInvoices = useMemo(
    () => invoices.filter((invoice) =>
      invoice.projectId === projectId &&
      invoice.id !== existingInvoice?.id &&
      invoice.status !== 'cancelled'
    ),
    [existingInvoice?.id, invoices, projectId]
  );

  const projectSummary = useMemo<ProjectInvoiceSummary | undefined>(() => {
    if (invoiceType !== 'project' || !selectedProject) return undefined;

    const previousAmount = previousProjectInvoices.reduce(
      (sum, invoice) => sum + (Number(invoice.subtotal ?? invoice.netTotal) || 0),
      0
    );
    const previousPercentage = previousProjectInvoices.reduce(
      (sum, invoice) => sum + (Number(invoice.totalPercentage) || 0),
      0
    );
    const totalInvoicedAmount = previousAmount + projectInvoiceAmount;
    const totalInvoicedPercentage = previousPercentage + currentProjectPercentage;

    return {
      projectTotalValue: selectedProject.totalValue,
      previousPercentage,
      previousAmount,
      currentPercentage: currentProjectPercentage,
      currentAmount: projectInvoiceAmount,
      totalInvoicedPercentage,
      totalInvoicedAmount,
      remainingPercentage: Math.max(0, 100 - totalInvoicedPercentage),
      remainingAmount: Math.max(0, selectedProject.totalValue - totalInvoicedAmount),
    };
  }, [currentProjectPercentage, invoiceType, previousProjectInvoices, projectInvoiceAmount, selectedProject]);

  const getPreviousActivityInvoicedPercent = (activityId: string) => {
    let percent = 0;
    previousProjectInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (item.activityId === activityId) {
          percent += Number(item.completionPercentage) || 0;
        }
      });
    });
    return percent;
  };

  const netTotal = invoiceType === 'project' ? projectInvoiceAmount + vatTotal : normalGrandTotal;

  const displayedStatus: InvoiceStatus | 'draft' = existingInvoice ? calculateInvoicePaymentStatus(existingInvoice.id) : 'draft';
  const currentStatus: InvoiceStatus = existingInvoice?.status === 'draft'
    ? 'draft'
    : existingInvoice?.status === 'cancelled'
      ? 'cancelled'
      : displayedStatus;

  // Auto-update approvalStatus to paid if payment covers invoice
  useEffect(() => {
    if (currentStatus === 'paid' && approvalStatus !== 'paid') {
      setApprovalStatus('paid');
    }
  }, [currentStatus, approvalStatus]);

  const handleInvoiceTypeChange = (value: InvoiceType) => {
    setInvoiceType(value);
    setItems(value === 'project' ? [createProjectItem()] : [createNormalItem()]);
  };

  const updateNormalItem = (index: number, field: keyof LineItem, value: string | number | boolean) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'quantity' || field === 'rate') {
        item[field] = Number(value) || 0;
        item.total = roundMoney(item.quantity * item.rate);
        item.vatAmount = (item.vatApplicable && vatEnabled) ? roundMoney((item.total * (item.vatPercentage ?? 0)) / 100) : 0;
      } else if (field === 'vatApplicable') {
        item.vatApplicable = value as boolean;
        item.vatAmount = (item.vatApplicable && vatEnabled) ? roundMoney((item.total * (item.vatPercentage ?? 0)) / 100) : 0;
      } else {
        (item as any)[field] = value;
      }
      updated[index] = item;
      return updated;
    });
  };

  const updateProjectItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      
      if (field === 'activityId') {
        const activity = projectActivities.find(a => a.id === value);
        if (activity) {
          item.activityId = value as string;
          item.name = activity.name;
          item.completionPercentage = 0;
          item.total = 0;
          item.rate = 0;
        }
      } else if (field === 'completionPercentage') {
        const activity = projectActivities.find(a => a.id === item.activityId);
        if (activity) {
          const compPct = Number(value) || 0;
          const prevPct = getPreviousActivityInvoicedPercent(activity.id);
          const maxAllowed = 100 - prevPct; // 100% of the activity amount
          
          if (compPct > maxAllowed) {
            toast({ title: 'Over-invoicing prevented', description: `Cannot exceed remaining ${maxAllowed}% for this activity.`, variant: 'destructive'});
            return prev;
          }
          
          item.completionPercentage = compPct;
          item.total = roundMoney((activity.amount * compPct) / 100);
          item.rate = item.total;
        }
      } else if (field === 'description') {
         item.description = value as string;
      }
      
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
      const total = roundMoney(qty * rate);
      const vatAmount = (picked.vatApplicable && vatEnabled) ? roundMoney((total * picked.vatPercentage) / 100) : 0;
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

  const addLineItem = () => setItems((prev) => [...prev, invoiceType === 'project' ? createProjectItem() : createNormalItem()]);

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast({ title: 'Cannot remove', description: 'At least one line is required.', variant: 'destructive' });
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddClient = () => {
    if (!newClient.name.trim()) {
      toast({ title: 'Error', description: 'Client name is required', variant: 'destructive' });
      return;
    }
    const client: Client = { id: safeRandomUUID(), ...newClient, type: 'customer', createdAt: new Date().toISOString() };
    addClient(client);
    setClientId(client.id);
    setIsAddClientOpen(false);
    setNewClient({ name: '', email: '', phone: '', address: '' });
    toast({ title: 'Client added', description: `${client.name} has been added.` });
  };

  const handleAddSalesman = () => {
    const name = newSalesman.name.trim();
    if (!name) {
      toast({ title: 'Error', description: 'Salesman name is required', variant: 'destructive' });
      return;
    }

    const salesman = {
      id: safeRandomUUID(),
      name,
      phone: newSalesman.phone.trim(),
      createdAt: new Date().toISOString(),
    };
    addSalesman(salesman);
    setSalesmanId(salesman.id);
    setIsAddSalesmanOpen(false);
    setNewSalesman({ name: '', phone: '' });
    toast({ title: 'Salesman added', description: `${salesman.name} created.` });
  };

  const validateInvoice = () => {
    if (invoiceType === 'project' && !invoiceNumberPart) return 'Please provide an invoice number sequence';
    if (!clientId) return 'Please select a client';
    if (!salesmanId) return 'Please select a salesman';
    if (invoiceType === 'project') {
      if (!projectId) return 'Please select a project';
      if (!selectedProject?.valuationCompleted) return 'Project valuation (BOQ) must be completed first';
      if (items.some((item) => !item.activityId)) return 'All project invoice lines must be linked to a specific activity';
      if (items.some((item) => !item.completionPercentage || item.completionPercentage <= 0)) return 'Completion percentage must be greater than zero for all lines';
      return null;
    }
    if (items.some((item) => !item.name.trim())) return 'All items must have a name';
    return null;
  };

  const buildInvoicePayload = (now: string, base?: Invoice): Invoice => ({
    ...(base || {}),
    id: base?.id || safeRandomUUID(),
    number: invoiceType === 'project' ? `${mitcPrefix}${invoiceNumberPart}` : (base?.number || `INV-${Date.now().toString().slice(-4)}`),
    clientId,
    quotationId: sourceQuotation?.id || base?.quotationId,
    invoiceType,
    projectId: invoiceType === 'project' ? projectId : undefined,
    projectName: invoiceType === 'project' ? selectedProject?.name : undefined,
    lpoNumber: invoiceType === 'project' ? selectedProject?.lpoNumber : undefined,
    projectTotalValue: invoiceType === 'project' ? selectedProject?.totalValue : undefined,
    totalPercentage: invoiceType === 'project' ? currentProjectPercentage : undefined,
    discountType: invoiceType === 'normal' ? discountType : undefined,
    discountValue: invoiceType === 'normal' ? Number(discountValue) || 0 : undefined,
    discountAmount: invoiceType === 'normal' ? discountAmount : undefined,
    subtotal: invoiceType === 'normal' ? normalSubtotal : projectInvoiceAmount,
    vatTotal,
    projectSummary: invoiceType === 'project' ? projectSummary : undefined,
    items,
    netTotal: roundMoney(netTotal),
    status: base?.status || 'draft',
    approvalStatus: invoiceType === 'project' ? approvalStatus : undefined,
    dueDate,
    notes,
    terms,
    salesmanId,
    createdAt: base?.createdAt || now,
    updatedAt: now,
  } as Invoice);

  const handleSave = () => {
    const validationMessage = validateInvoice();
    if (validationMessage) {
      toast({ title: 'Error', description: validationMessage, variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();

    if (isEditing && existingInvoice) {
      const updated = buildInvoicePayload(now, existingInvoice);
      try {
        updateInvoice(updated);
        repostSalesInvoice(existingInvoice, updated);
      } catch (err) {
        updateInvoice(existingInvoice);
        toast({ title: 'Invoice update failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
        return;
      }

      toast({ title: 'Invoice updated', description: `${updated.number} has been updated.` });
    } else {
      const newInvoice = buildInvoicePayload(now);
      addInvoice(newInvoice);

      if (invoiceType === 'normal') {
        items.forEach((li) => { if (li.itemId) adjustItemStock(li.itemId, -li.quantity); });
      }

      if (sourceQuotation) {
        updateQuotation({ ...sourceQuotation, status: 'converted', convertedInvoiceId: newInvoice.id, updatedAt: now });
      }

      try {
        postSalesInvoice(newInvoice);
      } catch (err) {
        console.error('[InvoiceForm] Journal entry failed:', err);
        toast({ title: 'Journal entry failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      }

      toast({ title: 'Invoice created', description: `${newInvoice.number} has been created.` });
      navigate(`/invoices/${newInvoice.id}`);
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
      await generatePDF({ type: 'invoice', document: buildInvoicePayload(new Date().toISOString(), existingInvoice), client, settings });
      toast({ title: 'PDF downloaded successfully' });
    } catch (err) {
      toast({ title: 'PDF generation failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const handleShare = () => {
    if (!existingInvoice) return;
    const client = getClient(clientId);
    shareViaWhatsApp({ type: 'invoice', document: buildInvoicePayload(new Date().toISOString(), existingInvoice), client, settings });
  };

  useDelayedMissingRedirect(Boolean(isEditing), Boolean(existingInvoice), '/invoices');

  const statusColors: Record<InvoiceStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-primary/10 text-primary',
    paid: 'bg-success/10 text-success',
    partial: 'bg-warning/10 text-warning',
    overdue: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')} className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">
              {isEditing ? existingInvoice?.number : 'New Invoice'}
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block truncate">
              {invoiceType === 'project' ? 'Project Activity Billing' : sourceQuotation ? `From ${sourceQuotation.number}` : 'Standard Invoice'}
            </p>
          </div>
          {isEditing && (
            <Badge variant="outline" className={`${statusColors[currentStatus]} text-xs ml-1 capitalize`}>
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
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Billing Details</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="vat-toggle" className="text-sm cursor-pointer font-medium">Apply VAT</Label>
            <Switch id="vat-toggle" checked={vatEnabled} onCheckedChange={setVatEnabled} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Type</Label>
              <Select value={invoiceType} onValueChange={(value) => handleInvoiceTypeChange(value as InvoiceType)} disabled={Boolean(isEditing)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal Invoice</SelectItem>
                  <SelectItem value="project">Project Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {invoiceType === 'project' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Invoice Number</Label>
                <div className="flex items-center">
                  <span className="inline-flex h-9 items-center px-3 rounded-l-md border border-r-0 bg-muted text-sm text-muted-foreground shrink-0">
                    {mitcPrefix}
                  </span>
                  <Input 
                    value={invoiceNumberPart} 
                    onChange={(e) => setInvoiceNumberPart(e.target.value)} 
                    placeholder="001" 
                    className="h-9 rounded-l-none"
                    disabled={isEditing}
                  />
                </div>
              </div>
            )}

            <div className={`space-y-1.5 ${invoiceType !== 'project' ? 'sm:col-span-2' : ''}`}>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Client</Label>
              <div className="flex gap-1.5">
                <Select value={clientId} onValueChange={setClientId} disabled={invoiceType === 'project'}>
                  <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
                {invoiceType !== 'project' && (
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setIsAddClientOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Salesman</Label>
              <div className="flex gap-1.5">
                <Select value={salesmanId} onValueChange={setSalesmanId}>
                  <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Select salesman" /></SelectTrigger>
                  <SelectContent>{salesmen.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setIsAddSalesmanOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {invoiceType === 'project' && (
            <div className="grid gap-4 sm:grid-cols-3 pt-3 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Project</Label>
                <Select value={projectId} onValueChange={setProjectId} disabled={isEditing}>
                  <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Select completed project" /></SelectTrigger>
                  <SelectContent>
                    {completedValuationProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                    {completedValuationProjects.length === 0 && (
                      <SelectItem value="none" disabled>No valuated projects found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedProject && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">LPO Number</Label>
                    <Input value={selectedProject.lpoNumber} readOnly className="h-9 bg-muted/50 cursor-not-allowed" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Total Value</Label>
                    <Input value={formatCurrency(selectedProject.totalValue)} readOnly className="h-9 text-right bg-muted/50 cursor-not-allowed" />
                  </div>
                </>
              )}
            </div>
          )}

          {invoiceType === 'project' && (
             <div className="grid gap-4 sm:grid-cols-4 pt-3 border-t">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Approval Stage</Label>
                  <Select value={approvalStatus} onValueChange={(val: InvoiceApprovalStatus) => setApprovalStatus(val)} disabled={currentStatus === 'paid'}>
                    <SelectTrigger className="h-9 capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="site_engineer">Site Engineer</SelectItem>
                      <SelectItem value="qc">QC Approval</SelectItem>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="accounts">Accounts</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
             </div>
          )}

          {invoiceType === 'project' && projectSummary && (
            <div className="pt-3 border-t space-y-3">
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Project Value</p>
                  <p className="text-sm font-semibold">{formatCurrency(projectSummary.projectTotalValue)}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Previous</p>
                  <p className="text-sm font-semibold">{formatPercent(projectSummary.previousPercentage)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(projectSummary.previousAmount)}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Current</p>
                  <p className="text-sm font-semibold">{formatPercent(projectSummary.currentPercentage)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(projectSummary.currentAmount)}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Total Progress</p>
                  <p className="text-sm font-semibold">{formatPercent(projectSummary.totalInvoicedPercentage)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(projectSummary.totalInvoicedAmount)}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Remaining</p>
                  <p className="text-sm font-semibold">{formatPercent(projectSummary.remainingPercentage)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(projectSummary.remainingAmount)}</p>
                </div>
              </div>
              <Progress value={Math.min(100, Math.max(0, projectSummary.totalInvoicedPercentage))} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4 bg-muted/20 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            {invoiceType === 'project' ? 'Project Activities to Bill' : 'Line Items'}
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="h-8">
            <Plus className="mr-1.5 h-4 w-4" />Add Line
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-3 px-4 w-12 font-semibold">#</th>
                  {invoiceType === 'project' ? (
                    <>
                      <th className="text-left py-3 px-4 font-semibold">Project Activity</th>
                      <th className="text-right py-3 px-4 w-32 font-semibold">Completion %</th>
                      <th className="text-right py-3 px-4 w-32 font-semibold">Invoice Value</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left py-3 px-4 font-semibold">Item / Description</th>
                      <th className="text-right py-3 px-4 w-24 font-semibold">Qty</th>
                      <th className="text-right py-3 px-4 w-32 font-semibold">Rate</th>
                      <th className="text-right py-3 px-4 w-32 font-semibold">Amount</th>
                    </>
                  )}
                  <th className="w-12 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-muted/5 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground font-medium">{index + 1}</td>
                    
                    {invoiceType === 'project' ? (
                      <td className="py-3 px-4">
                        <Select 
                          value={item.activityId || ''} 
                          onValueChange={(val) => updateProjectItem(index, 'activityId', val)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select Activity from BOQ" />
                          </SelectTrigger>
                          <SelectContent>
                            {projectActivities.map(a => {
                              const prevInvoiced = getPreviousActivityInvoicedPercent(a.id);
                              return (
                                <SelectItem key={a.id} value={a.id} disabled={prevInvoiced >= 100}>
                                  {a.name} - {formatCurrency(a.amount)} ({100 - prevInvoiced}% remaining)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </td>
                    ) : (
                      <td className="py-3 px-4">
                        <div className="space-y-2">
                          <ItemPicker value={item.itemId} fallbackName={item.name} onSelect={(it) => selectItemForRow(index, it)} />
                          <Textarea value={item.description} onChange={(e) => updateNormalItem(index, 'description', e.target.value)} placeholder="Additional details..." rows={1} className="text-sm min-h-[40px] resize-y" />
                        </div>
                      </td>
                    )}

                    {invoiceType === 'project' ? (
                      <>
                        <td className="py-3 px-4">
                          <div className="relative">
                            <Input 
                              type="number" 
                              min="0" max="100" step="0.01" 
                              value={item.completionPercentage || ''} 
                              onChange={(e) => updateProjectItem(index, 'completionPercentage', e.target.value)} 
                              className="h-9 text-right pr-6" 
                              disabled={!item.activityId}
                            />
                            <span className="absolute right-2.5 top-2 text-muted-foreground text-xs">%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Input 
                            value={item.total.toFixed(2)} 
                            readOnly 
                            className="h-9 text-right font-medium bg-muted/30" 
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4"><Input type="number" min="1" value={item.quantity} onChange={(e) => updateNormalItem(index, 'quantity', e.target.value)} className="h-9 text-right" /></td>
                        <td className="py-3 px-4"><Input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateNormalItem(index, 'rate', e.target.value)} className="h-9 text-right" /></td>
                        <td className="py-3 px-4 text-right font-semibold">{currencySymbol}{(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </>
                    )}

                    <td className="py-3 px-2 text-center">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-muted/10 p-4 border-t flex flex-col items-end">
            <div className="w-full sm:w-80 space-y-2.5">
              {invoiceType === 'normal' ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{currencySymbol}{normalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_90px_100px] gap-2 items-center text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <Select value={discountType} onValueChange={(value) => setDiscountType(value as DiscountType)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="percentage">%</SelectItem><SelectItem value="fixed">Fixed</SelectItem></SelectContent>
                    </Select>
                    <Input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value) || 0)} className="h-8 text-right text-xs" />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Activity Value</span>
                  <span className="font-medium">{currencySymbol}{projectInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {vatEnabled && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">VAT</span>
                  <span className="font-medium">{currencySymbol}{vatTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-lg font-bold pt-3 border-t mt-2">
                <span>Total Amount</span>
                <span className="text-primary">{currencySymbol}{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 lg:relative p-4 lg:p-0 bg-background border-t lg:border-0 z-30 shadow-lg lg:shadow-none">
        <div className="max-w-5xl mx-auto flex gap-3 justify-end">
          {currentStatus === 'draft' && (
            <Button onClick={handleSave} size="lg" className="h-11 px-8 rounded-full shadow-md shadow-primary/20">
              <Save className="mr-2 h-5 w-5" /> {isEditing ? 'Save Invoice' : 'Create Invoice'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Quick add a new client</DialogDescription>
          </DialogHeader>
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
            <DialogDescription>Quick add a new salesperson</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="space-y-1.5"><Label htmlFor="salesmanName" className="text-xs">Name *</Label><Input id="salesmanName" value={newSalesman.name} onChange={(e) => setNewSalesman({ ...newSalesman, name: e.target.value })} placeholder="Salesperson name" className="h-9" /></div>
            <div className="space-y-1.5"><Label htmlFor="salesmanPhone" className="text-xs">Phone</Label><Input id="salesmanPhone" value={newSalesman.phone} onChange={(e) => setNewSalesman({ ...newSalesman, phone: e.target.value })} placeholder="Phone number" className="h-9" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddSalesmanOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddSalesman}>Add Salesman</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
