import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, ArrowLeft, Percent, Save } from 'lucide-react';
import { safeRandomUUID } from '@/lib/uuid';
import type { Project, ProjectActivity, ProjectStatus } from '@/types';

export default function ProjectForm() {
  const { id } = useParams();
  const { projects, addProject, updateProject, getCustomers, getVendors, settings } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditing = Boolean(id);
  const vendors = getVendors();
  const customers = getCustomers();

  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    vendorId: '',
    customerId: '',
    lpoNumber: '',
    totalValue: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    status: 'active',
    activities: [],
    valuationCompleted: false,
  });

  const [activities, setActivities] = useState<ProjectActivity[]>([]);

  useEffect(() => {
    if (isEditing && id) {
      const project = projects.find(p => p.id === id);
      if (project) {
        setFormData(project);
        setActivities(project.activities || []);
      }
    }
  }, [id, isEditing, projects]);

  const handleActivityChange = (index: number, field: keyof ProjectActivity, value: string | number) => {
    const updated = [...activities];
    if (field === 'percentage') {
      const pct = Number(value) || 0;
      updated[index].percentage = pct;
      updated[index].amount = (pct / 100) * (formData.totalValue || 0);
    } else if (field === 'name') {
      updated[index].name = value as string;
    }
    setActivities(updated);
  };

  const addActivity = () => {
    setActivities([
      ...activities,
      { id: safeRandomUUID(), name: '', percentage: 0, amount: 0 }
    ]);
  };

  const removeActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  const totalPercentage = activities.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
  const totalAmount = activities.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Recalculate amounts if totalValue changes
  useEffect(() => {
    if (formData.totalValue && formData.totalValue > 0) {
      setActivities(prev => prev.map(a => ({
        ...a,
        amount: (a.percentage / 100) * (formData.totalValue || 0)
      })));
    }
  }, [formData.totalValue]);

  const handleSubmit = () => {
    if (!formData.name || !formData.vendorId || !formData.customerId || !formData.totalValue) {
      toast({ title: "Error", description: "Name, Customer, Vendor, and Total Value are required.", variant: "destructive" });
      return;
    }

    if (activities.length > 0 && Math.abs(totalPercentage - 100) > 0.01) {
      toast({ 
        title: "Validation Error", 
        description: "If activities are defined, their total percentage must be exactly 100%.", 
        variant: "destructive" 
      });
      return;
    }

    const isValuationCompleted = activities.length > 0 && Math.abs(totalPercentage - 100) <= 0.01;

    const projectData: Project = {
      ...(formData as Project),
      id: isEditing ? (id as string) : safeRandomUUID(),
      activities,
      valuationCompleted: isValuationCompleted,
      status: isValuationCompleted && formData.status === 'pending_valuation' ? 'active' : (formData.status as ProjectStatus) || 'active',
      totalInvoicedAmount: formData.totalInvoicedAmount || 0,
      totalInvoicedPercentage: formData.totalInvoicedPercentage || 0,
      remainingAmount: isEditing ? (formData.remainingAmount || 0) : (formData.totalValue || 0),
      remainingPercentage: isEditing ? (formData.remainingPercentage || 100) : 100,
      linkedInvoiceIds: formData.linkedInvoiceIds || [],
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isEditing) {
      updateProject(projectData);
      toast({ title: "Success", description: "Project updated successfully." });
    } else {
      addProject(projectData);
      toast({ title: "Success", description: "Project created successfully." });
    }
    navigate('/projects');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Project' : 'New Project'}</h1>
            <p className="text-sm text-muted-foreground">{isEditing ? 'Update project details and BOQ.' : 'Create a new project and define valuation.'}</p>
          </div>
        </div>
        <Button onClick={handleSubmit} className="gap-2">
          <Save className="h-4 w-4" /> Save Project
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Basic information with customer and vendor association.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Project Name *</Label>
              <Input 
                value={formData.name || ''} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="E.g. Commercial Villa Setup" 
              />
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Customer *</Label>
                <Select value={formData.customerId || ''} onValueChange={(val) => setFormData({...formData, customerId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                    ))}
                    {customers.length === 0 && (
                      <SelectItem value="no-customers" disabled>No customers found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Vendor *</Label>
                <Select value={formData.vendorId || ''} onValueChange={(val) => setFormData({...formData, vendorId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                    {vendors.length === 0 && (
                      <SelectItem value="no-vendors" disabled>No vendors found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>LPO Number</Label>
                <Input 
                  value={formData.lpoNumber || ''} 
                  onChange={(e) => setFormData({...formData, lpoNumber: e.target.value})} 
                  placeholder="LPO-XXXX" 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Total Value ({settings?.currency}) *</Label>
                <Input 
                  type="number" 
                  value={formData.totalValue || ''} 
                  onChange={(e) => setFormData({...formData, totalValue: Number(e.target.value)})} 
                  placeholder="0.00" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={formData.startDate || ''} 
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  value={formData.endDate || ''} 
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(val: ProjectStatus) => setFormData({...formData, status: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending_valuation">Pending Valuation</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Valuation (BOQ)</CardTitle>
            <CardDescription>Define activities to enable invoicing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                <Percent className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No activities defined</p>
                <p className="text-xs text-muted-foreground mb-4">You must add activities totaling 100% before you can create project invoices.</p>
                <Button variant="outline" size="sm" onClick={addActivity}>
                  <Plus className="h-4 w-4 mr-2" /> Add First Activity
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {activities.map((activity, index) => (
                    <div key={activity.id} className="flex items-start gap-2 p-3 bg-muted/30 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Input 
                          placeholder="Activity Name (e.g., Mobilization)" 
                          value={activity.name}
                          onChange={(e) => handleActivityChange(index, 'name', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <div className="relative w-24">
                            <Input 
                              type="number"
                              placeholder="%" 
                              value={activity.percentage || ''}
                              onChange={(e) => handleActivityChange(index, 'percentage', e.target.value)}
                              className="h-8 text-sm pr-6"
                            />
                            <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span>
                          </div>
                          <Input 
                            readOnly
                            value={activity.amount.toFixed(2)}
                            className="h-8 text-sm bg-muted/50 cursor-not-allowed flex-1"
                          />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeActivity(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addActivity}>
                  <Plus className="h-4 w-4 mr-2" /> Add Activity
                </Button>

                <div className={`p-4 rounded-lg flex justify-between items-center ${Math.abs(totalPercentage - 100) > 0.01 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                  <div>
                    <p className="text-sm font-semibold">Total BOQ</p>
                    <p className="text-xs opacity-90">{Math.abs(totalPercentage - 100) > 0.01 ? 'Must equal exactly 100%' : 'Valuation completed'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{totalPercentage.toFixed(2)}%</p>
                    <p className="text-xs font-medium">{settings?.currency} {totalAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
