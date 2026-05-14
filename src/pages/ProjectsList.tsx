import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { 
  Building2, 
  Briefcase, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  DollarSign,
  Calendar,
  Percent
} from 'lucide-react';
import type { Client, Project, Invoice, Payment } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ProjectsList() {
  const { getClient, getVendors, projects, invoices, payments, settings } = useApp();
  const navigate = useNavigate();
  const [selectedVendor, setSelectedVendor] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings?.currency || 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-primary/10 text-primary">Active</Badge>;
      case 'completed':
        return <Badge className="bg-success/10 text-success">Completed</Badge>;
      case 'pending_valuation':
        return <Badge className="bg-warning/10 text-warning">Pending Valuation</Badge>;
      case 'cancelled':
        return <Badge className="bg-destructive/10 text-destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const generateVendorSummaryPDF = (vendor: Client, vendorProjects: Project[]) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Vendor Projects Summary', 14, 22);
    doc.setFontSize(11);
    doc.text(`Vendor: ${vendor.name}`, 14, 30);
    if (vendor.contactPerson) doc.text(`Contact: ${vendor.contactPerson}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 42);

    const tableData = vendorProjects.map(p => [
      p.name,
      getClient(p.customerId)?.name || '-',
      p.lpoNumber || '-',
      formatCurrency(p.totalValue),
      formatCurrency(p.totalInvoicedAmount || 0),
      formatCurrency(p.totalPaymentReceived || 0),
      formatCurrency(p.remainingAmount || 0),
      p.status
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Project', 'Customer', 'LPO', 'Value', 'Invoiced', 'Paid', 'Balance', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`${vendor.name.replace(/\s+/g, '_')}_Projects_Summary.pdf`);
  };

  const generateProjectReportPDF = (project: Project, projectInvoices: Invoice[], projectPayments: Payment[]) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Project Detail Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Project: ${project.name}`, 14, 30);
    doc.text(`Customer: ${getClient(project.customerId)?.name || '-'}`, 14, 36);
    doc.text(`Vendor: ${getClient(project.vendorId)?.name || '-'}`, 14, 42);
    doc.text(`LPO: ${project.lpoNumber}`, 14, 48);
    doc.text(`Total Value: ${formatCurrency(project.totalValue)}`, 14, 54);
    
    // BOQ Activities Table
    doc.setFontSize(14);
    doc.text('Activities (BOQ)', 14, 67);
    
    const boqData = project.activities.map(a => [
      a.name,
      `${a.percentage}%`,
      formatCurrency(a.amount)
    ]);
    
    autoTable(doc, {
      startY: 72,
      head: [['Activity', 'Percentage', 'Value']],
      body: boqData,
      theme: 'grid',
    });
    
    const nextY = (doc as any).lastAutoTable.finalY + 15;
    
    // Invoices Table
    doc.setFontSize(14);
    doc.text('Invoices', 14, nextY);
    
    const invoiceData = projectInvoices.map(inv => [
      inv.number,
      formatDate(inv.createdAt),
      formatCurrency(inv.netTotal),
      inv.approvalStatus || inv.status
    ]);
    
    autoTable(doc, {
      startY: nextY + 5,
      head: [['Invoice #', 'Date', 'Amount', 'Status']],
      body: invoiceData,
      theme: 'grid',
    });
    
    doc.save(`${project.name.replace(/\s+/g, '_')}_Report.pdf`);
  };

  const vendors = getVendors();
  const vendorsWithProjects = vendors.filter(v => 
    projects.some(p => p.vendorId === v.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage vendors, projects, valuations, and billing.</p>
        </div>
        <Button onClick={() => navigate('/projects/new')} className="gap-2">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {!selectedVendor ? (
        // Level 1: Vendors List
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vendorsWithProjects.length === 0 ? (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Briefcase className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-lg font-medium">No projects found</p>
                <p className="text-sm text-muted-foreground mb-4">Create your first project to get started.</p>
                <Button onClick={() => navigate('/projects/new')}>Create Project</Button>
              </CardContent>
            </Card>
          ) : (
            vendorsWithProjects.map(vendor => {
              const vendorProjects = projects.filter(p => p.vendorId === vendor.id);
              const totalValue = vendorProjects.reduce((sum, p) => sum + p.totalValue, 0);
              const totalInvoiced = vendorProjects.reduce((sum, p) => sum + (p.totalInvoicedAmount || 0), 0);
              
              return (
                <Card 
                  key={vendor.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedVendor(vendor)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg">{vendor.name}</CardTitle>
                      </div>
                      <Badge variant="secondary">{vendorProjects.length} Projects</Badge>
                    </div>
                    {vendor.contactPerson && (
                      <CardDescription className="pt-2">Contact: {vendor.contactPerson}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Value:</span>
                        <span className="font-medium">{formatCurrency(totalValue)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Invoiced:</span>
                        <span className="font-medium">{formatCurrency(totalInvoiced)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        // Level 2: Projects under selected vendor
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <button onClick={() => setSelectedVendor(null)} className="hover:text-foreground transition-colors">
              Vendors
            </button>
            <ArrowRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{selectedVendor.name}</span>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Projects for {selectedVendor.name}</h2>
            <Button variant="outline" size="sm" onClick={() => generateVendorSummaryPDF(selectedVendor, projects.filter(p => p.vendorId === selectedVendor.id))}>
              <FileText className="mr-2 h-4 w-4" /> Export Summary
            </Button>
          </div>

          <div className="grid gap-4">
            {projects.filter(p => p.vendorId === selectedVendor.id).map(project => (
              <Card 
                key={project.id}
                className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{project.name}</h3>
                        {getStatusBadge(project.status)}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4" />
                          LPO: {project.lpoNumber}
                        </div>
                        {project.customerId && (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4" />
                            Customer: {getClient(project.customerId)?.name || 'Unknown'}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {formatDate(project.startDate)} - {formatDate(project.endDate)}
                        </div>
                        {!project.valuationCompleted && (
                          <div className="flex items-center gap-1.5 text-warning font-medium">
                            <AlertCircle className="h-4 w-4" />
                            BOQ Pending
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-8 md:text-right text-sm border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-8 mt-4 md:mt-0">
                      <div>
                        <p className="text-muted-foreground mb-1">Total Value</p>
                        <p className="font-semibold text-base">{formatCurrency(project.totalValue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Invoiced</p>
                        <p className="font-semibold text-base">{formatCurrency(project.totalInvoicedAmount || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Balance</p>
                        <p className="font-semibold text-base">{formatCurrency(project.remainingAmount || 0)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Level 3: Project Details Sheet */}
      <Sheet open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
          {selectedProject && (
            <div className="space-y-8 py-4">
              <SheetHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <SheetTitle className="text-2xl">{selectedProject.name}</SheetTitle>
                    <SheetDescription className="mt-1 flex items-center gap-2">
                      LPO: {selectedProject.lpoNumber} • Customer: {getClient(selectedProject.customerId)?.name || '-'} • Vendor: {selectedVendor?.name}
                    </SheetDescription>
                  </div>
                  {getStatusBadge(selectedProject.status)}
                </div>
              </SheetHeader>

              <div className="flex gap-2">
                 <Button variant="outline" className="flex-1" onClick={() => navigate(`/projects/${selectedProject.id}`)}>
                    Edit Project
                 </Button>
                 <Button variant="outline" className="flex-1" onClick={() => {
                   const pInvoices = invoices.filter(i => selectedProject.linkedInvoiceIds?.includes(i.id));
                   const pPayments = payments.filter(p => pInvoices.some(i => i.id === p.invoiceId));
                   generateProjectReportPDF(selectedProject, pInvoices, pPayments);
                 }}>
                    <FileText className="mr-2 h-4 w-4" /> Export Report
                 </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30 border-none shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-xl font-bold">{formatCurrency(selectedProject.totalValue)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30 border-none shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Invoiced</p>
                    <p className="text-xl font-bold">{formatCurrency(selectedProject.totalInvoicedAmount || 0)}</p>
                    <p className="text-xs text-muted-foreground">{selectedProject.totalInvoicedPercentage?.toFixed(2)}%</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Percent className="h-5 w-5 text-primary" /> Valuation / BOQ
                  </h3>
                  {!selectedProject.valuationCompleted ? (
                    <Badge variant="outline" className="text-warning border-warning"><AlertCircle className="w-3 h-3 mr-1"/> Pending</Badge>
                  ) : (
                    <Badge variant="outline" className="text-success border-success"><CheckCircle2 className="w-3 h-3 mr-1"/> Completed</Badge>
                  )}
                </div>
                
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium text-muted-foreground">Activity</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">%</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedProject.activities?.map((activity) => (
                        <tr key={activity.id} className="hover:bg-muted/30">
                          <td className="p-3">{activity.name}</td>
                          <td className="p-3 text-right">{activity.percentage}%</td>
                          <td className="p-3 text-right font-medium">{formatCurrency(activity.amount)}</td>
                        </tr>
                      ))}
                      {(!selectedProject.activities || selectedProject.activities.length === 0) && (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-muted-foreground">No activities defined.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Invoices
                </h3>
                
                <div className="space-y-3">
                  {invoices.filter(i => selectedProject.linkedInvoiceIds?.includes(i.id)).map(invoice => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                      <div>
                        <p className="font-medium">{invoice.number}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(invoice.netTotal)}</p>
                        <Badge variant="outline" className="mt-1 capitalize text-[10px]">
                          {invoice.approvalStatus || invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {(!selectedProject.linkedInvoiceIds || selectedProject.linkedInvoiceIds.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">No invoices generated yet.</p>
                  )}
                </div>
              </div>

            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
