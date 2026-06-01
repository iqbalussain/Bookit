import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import type { Project, ProjectActivity, ProjectStatus } from '@/types';

const projectStatuses: ProjectStatus[] = ['planned', 'active', 'completed', 'on_hold', 'cancelled'];

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { projects, addProject, updateProject, getCustomers, getProject } = useApp();

  const isEditing = Boolean(id);
  const existingProject = isEditing ? getProject(id ?? '') : undefined;

  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    customerId: '',
    lpoNumber: '',
    totalValue: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
    status: 'planned',
    activities: [],
  });

  useEffect(() => {
    if (existingProject) {
      setFormData({ ...existingProject });
    }
  }, [existingProject]);

  const customers = getCustomers();

  const handleSubmit = () => {
    if (!formData.name || !formData.customerId || !formData.totalValue) {
      toast({ title: 'Error', description: 'Name, customer, and total value are required.', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();
    const project: Project = {
      id: existingProject?.id || crypto.randomUUID(),
      name: formData.name,
      customerId: formData.customerId,
      vendorId: existingProject?.vendorId || '',
      lpoNumber: formData.lpoNumber || '',
      totalValue: Number(formData.totalValue) || 0,
      startDate: formData.startDate || new Date().toISOString().split('T')[0],
      endDate: formData.endDate || new Date().toISOString().split('T')[0],
      status: formData.status || 'planned',
      activities: formData.activities || [],
      createdAt: existingProject?.createdAt || now,
      updatedAt: now,
    };

    if (existingProject) {
      updateProject(project);
      toast({ title: 'Project updated', description: `${project.name} has been updated.` });
    } else {
      addProject(project);
      toast({ title: 'Project created', description: `${project.name} has been created.` });
    }

    navigate('/projects');
  };

  const updateActivity = (index: number, field: keyof ProjectActivity, value: string | number) => {
    setFormData((prev) => {
      const activities = [...(prev.activities || [])];
      const current = { ...(activities[index] || { id: crypto.randomUUID(), name: '', percentage: 0, value: 0 }) };
      if (field === 'percentage' || field === 'value') {
        (current as any)[field] = Number(value) || 0;
      } else {
        (current as any)[field] = value;
      }
      activities[index] = current;
      return { ...prev, activities };
    });
  };

  const addActivity = () => {
    setFormData((prev) => ({
      ...prev,
      activities: [
        ...(prev.activities || []),
        { id: crypto.randomUUID(), name: '', percentage: 0, value: 0 },
      ],
    }));
  };

  const removeActivity = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      activities: (prev.activities || []).filter((_, idx) => idx !== index),
    }));
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight truncate">
              {isEditing ? existingProject?.name : 'New Project'}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block truncate">
              {isEditing ? 'Edit project details' : 'Create new project' }
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} size="sm" className="h-9">
          <Save className="mr-1.5 h-4 w-4" />{isEditing ? 'Save Project' : 'Create Project'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Project Name *</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-9" />
          </div>

          <div className="grid gap-4 sm:grid-cols-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer *</Label>
              <Select value={formData.customerId || ''} onValueChange={(value) => setFormData({ ...formData, customerId: value })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Total Project Value *</Label>
              <Input type="number" min="0" step="0.01" value={formData.totalValue} onChange={(e) => setFormData({ ...formData, totalValue: Number(e.target.value) || 0 })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="h-9" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">LPO Number</Label>
              <Input value={formData.lpoNumber} onChange={(e) => setFormData({ ...formData, lpoNumber: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={formData.status || 'planned'} onValueChange={(value) => setFormData({ ...formData, status: value as ProjectStatus })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {projectStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Project Activities (BOQ)</p>
                <p className="text-xs text-muted-foreground">Optional activity breakdown</p>
              </div>
              <Button variant="outline" size="sm" onClick={addActivity} className="h-9">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Activity
              </Button>
            </div>

            {(formData.activities || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities added yet.</p>
            ) : (
              <div className="space-y-3">
                {(formData.activities || []).map((activity, index) => (
                  <div key={activity.id} className="rounded-lg border p-3">
                    <div className="grid gap-3 sm:grid-cols-4 items-end">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Activity</Label>
                        <Input value={activity.name} onChange={(e) => updateActivity(index, 'name', e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Percentage</Label>
                        <Input type="number" min="0" max="100" value={activity.percentage} onChange={(e) => updateActivity(index, 'percentage', e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Value</Label>
                        <Input type="number" min="0" step="0.01" value={activity.value} onChange={(e) => updateActivity(index, 'value', e.target.value)} className="h-9" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeActivity(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
