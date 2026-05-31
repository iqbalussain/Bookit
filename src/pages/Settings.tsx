import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import type { BusinessSettings } from '@/types';
import { Building2, Save, Upload, Trash2, Globe, Mail, Phone, MapPin, FileText, RefreshCw, Info, Pencil, Check, X, Plus } from 'lucide-react';
import BackupRestore from '@/components/BackupRestore';
import { useState, useEffect } from 'react';
import { pingServer } from '@/lib/apiClient';

export default function Settings() {
  const {
    settings,
    setSettings,
    companies,
    selectedCompanyId,
    setSelectedCompanyId,
    createCompany,
    updateCompany,
    deleteCompany,
  } = useApp();
  const { theme, setTheme } = useTheme();

  const { toast } = useToast();
  const [companyName, setCompanyName] = useState('');
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');
  const [checking, setChecking] = useState(false);

  // LAN multi-user
  const [lanMode, setLanMode] = useState<'standalone' | 'client'>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem('lan.mode') as any)) || 'standalone'
  );
  const [lanUrl, setLanUrl] = useState<string>(() =>
    (typeof window !== 'undefined' && localStorage.getItem('lan.serverUrl')) || ''
  );
  const [lanTesting, setLanTesting] = useState(false);
  const [lanStatus, setLanStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  const saveNetwork = async () => {
    if (lanMode === 'client') {
      if (!lanUrl.trim()) {
        toast({ title: 'Server URL required', description: 'Please enter the LAN server URL.', variant: 'destructive' });
        return;
      }
      const ping = await pingServer(lanUrl);
      if (!ping.ok) {
        toast({ title: 'Cannot reach server', description: (ping as { error: string }).error, variant: 'destructive' });
        return;
      }
    }
    localStorage.setItem('lan.mode', lanMode);
    localStorage.setItem('lan.serverUrl', lanUrl.trim());
    toast({ title: 'Network settings saved', description: 'Reloading to apply changes…' });
    setTimeout(() => window.location.reload(), 600);
  };

  const testConnection = async () => {
    setLanTesting(true);
    const res = await pingServer(lanUrl);
    setLanTesting(false);
    setLanStatus(res.ok ? 'ok' : 'fail');
    toast({
      title: res.ok ? 'Connection successful' : 'Connection failed',
      description: res.ok ? `Server responded at ${new Date(res.time).toLocaleTimeString()}` : (res as { error: string }).error,
      variant: res.ok ? 'default' : 'destructive',
    });
  };

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    if (!window.electronAPI?.update) return;
    const loadVersion = async () => {
      try {
        const version = await window.electronAPI!.update.getVersion();
        setCurrentVersion(version);
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };
    loadVersion();
  }, []);

  useEffect(() => {
    if (settings.theme) {
      setTheme(settings.theme);
    }
  }, [settings.theme, setTheme]);

  const handleCheckUpdates = async () => {
    if (!window.electronAPI?.update) {
      toast({ title: 'Not available', description: 'Updates are only available in the desktop app.', variant: 'destructive' });
      return;
    }
    setChecking(true);
    try {
      await window.electronAPI.update.checkForUpdates();
      toast({
        title: 'Update check completed',
        description: 'If an update is available, you will see a notification.',
      });
    } catch (error) {
      toast({
        title: 'Update check failed',
        description: 'Unable to check for updates. Please check your internet connection.',
        variant: 'destructive',
      });
    }
    setTimeout(() => setChecking(false), 3000);
  };

  const handleAddCompany = () => {
    const name = companyName.trim();
    if (!name) {
      toast({ title: 'Name required', description: 'Please enter a company name.', variant: 'destructive' });
      return;
    }
    createCompany(name);
    setCompanyName('');
    toast({ title: 'Company created', description: `Created and switched to ${name}.` });
  };

  const startEditing = (companyId: string, currentName: string) => {
    setEditingCompanyId(companyId);
    setEditName(currentName);
  };

  const saveEdit = () => {
    if (!editingCompanyId) return;
    const name = editName.trim();
    if (!name) {
      toast({ title: 'Name required', description: 'Company name cannot be empty.', variant: 'destructive' });
      return;
    }
    updateCompany(editingCompanyId, name);
    setEditingCompanyId(null);
    setEditName('');
    toast({ title: 'Company updated', description: `Company renamed to ${name}.` });
  };

  const cancelEdit = () => {
    setEditingCompanyId(null);
    setEditName('');
  };

  const handleDeleteCompany = (id: string) => {
    if (id === 'default') {
      toast({ title: 'Cannot delete', description: 'Default company cannot be deleted.', variant: 'destructive' });
      return;
    }
    if (!confirm('Are you sure you want to delete this company? All its data will be removed.')) return;
    deleteCompany(id);
    toast({ title: 'Company deleted', description: 'Company data has been removed.', variant: 'destructive' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Settings saved',
      description: 'Your business settings have been updated.',
    });
  };

  const handleChange = (field: keyof BusinessSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 500KB.',
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev) => ({ ...prev, logo: reader.result as string }));
        toast({ title: 'Logo uploaded', description: 'Your logo has been updated.' });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setSettings((prev) => ({ ...prev, logo: undefined }));
    toast({ title: 'Logo removed', description: 'Your logo has been removed.' });
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 500KB.',
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev) => ({ ...prev, signature: reader.result as string }));
        toast({ title: 'Signature uploaded', description: 'Your signature has been updated.' });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSignature = () => {
    setSettings((prev) => ({ ...prev, signature: undefined }));
    toast({ title: 'Signature removed', description: 'Your signature has been removed.' });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="space-y-0.5">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage your business profile</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company Management */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Manage Companies
            </CardTitle>
            <CardDescription className="text-xs">
              Create, edit, switch, and delete company profiles.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Company List */}
            <div className="space-y-1">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                    company.id === selectedCompanyId
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  {editingCompanyId === company.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex-1 text-left text-sm font-medium truncate"
                      onClick={() => setSelectedCompanyId(company.id)}
                    >
                      {company.name}
                    </button>
                  )}

                  {company.id === selectedCompanyId && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
                      Active
                    </Badge>
                  )}

                  {editingCompanyId === company.id ? (
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEditing(company.id, company.name)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={company.id === 'default'}
                        onClick={() => handleDeleteCompany(company.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Create New Company */}
            <div className="space-y-1.5">
              <Label htmlFor="new-company" className="text-xs">Create New Company</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="new-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="h-9"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCompany(); } }}
                />
                <Button type="button" size="sm" onClick={handleAddCompany} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logo Section */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Business Logo</CardTitle>
            <CardDescription className="text-xs">Appears on quotations and invoices</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
                  {settings.logo ? (
                    <img src={settings.logo} alt="Logo" className="h-full w-full object-contain rounded-lg p-1" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground/50" />
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Label
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors text-xs font-medium"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </Label>
                  <Input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  {settings.logo && (
                    <Button type="button" variant="outline" size="sm" onClick={removeLogo} className="h-7 text-xs gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">PNG, JPG or SVG. Max 500KB.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Business Name</Label>
                <Input id="name" value={settings.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Your Business Name" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  Email
                </Label>
                <Input id="email" type="email" value={settings.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="email@example.com" className="h-9" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  Phone
                </Label>
                <Input id="phone" value={settings.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+91 98765 43210" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taxNumber" className="text-xs flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  GST/Tax Number
                </Label>
                <Input id="taxNumber" value={settings.taxNumber || ''} onChange={(e) => handleChange('taxNumber', e.target.value)} placeholder="GSTIN" className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                Address
              </Label>
              <Textarea id="address" value={settings.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="Business address" rows={2} className="resize-none text-sm" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bankName" className="text-xs">Bank Name</Label>
                <Input id="bankName" value={settings.bankName || ''} onChange={(e) => handleChange('bankName', e.target.value)} placeholder="Bank name" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankAccountNumber" className="text-xs">Bank Account Number</Label>
                <Input id="bankAccountNumber" value={settings.bankAccountNumber || ''} onChange={(e) => handleChange('bankAccountNumber', e.target.value)} placeholder="Account number" className="h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signature Section */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Digital Signature</CardTitle>
            <CardDescription className="text-xs">Signature to appear on quotations and invoices</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-24 w-32 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
                  {settings.signature ? (
                    <img src={settings.signature} alt="Signature" className="h-full w-full object-contain rounded-lg p-1" />
                  ) : (
                    <p className="text-xs text-muted-foreground">No signature</p>
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Label
                    htmlFor="signature-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors text-xs font-medium"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </Label>
                  <Input id="signature-upload" type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                  {settings.signature && (
                    <Button type="button" variant="outline" size="sm" onClick={removeSignature} className="h-7 text-xs gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">PNG, JPG or SVG. Max 500KB.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="currency" className="text-xs">Default Currency</Label>
              <Select value={settings.currency} onValueChange={(value) => handleChange('currency', value as BusinessSettings['currency'])}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">₹ INR - Indian Rupee</SelectItem>
                  <SelectItem value="USD">$ USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">€ EUR - Euro</SelectItem>
                  <SelectItem value="GBP">£ GBP - British Pound</SelectItem>
                  <SelectItem value="OMR">ر.ع. OMR - Omani Rial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="theme" className="text-xs">App Theme</Label>
              <Select
                value={settings.theme || 'system'}
                onValueChange={(value) => {
                  setSettings((prev) => ({ ...prev, theme: value as BusinessSettings['theme'] }));
                  setTheme(value as 'light' | 'dark' | 'system');
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3 max-w-md">
              <div>
                <Label className="text-xs">VAT Enabled</Label>
                <p className="text-[10px] text-muted-foreground">Apply VAT on quotations, invoices & purchases by default</p>
              </div>
              <Switch
                checked={settings.vatEnabled ?? true}
                onCheckedChange={(v) => setSettings((prev) => ({ ...prev, vatEnabled: v }))}
              />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="defaultVat" className="text-xs">Default VAT %</Label>
              <Input
                id="defaultVat"
                type="number"
                step="0.01"
                value={settings.defaultVatPercentage ?? 5}
                onChange={(e) => setSettings((prev) => ({ ...prev, defaultVatPercentage: Number(e.target.value) || 0 }))}
                disabled={!(settings.vatEnabled ?? true)}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Used when creating new items</p>
            </div>
          </CardContent>
        </Card>

        {/* About & Updates - Electron only */}
        {isElectron && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                About BookIt
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Current Version</p>
                  <p className="text-xs text-muted-foreground">v{currentVersion}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleCheckUpdates} disabled={checking} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Checking...' : 'Check for Updates'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Updates are downloaded automatically. You'll be notified when a new version is available.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Backup & Restore - Electron only */}
        {isElectron && <BackupRestore />}

        {/* Network / Multi-user (LAN) */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Network / Multi-user
            </CardTitle>
            <CardDescription className="text-xs">
              Share data between PCs on the same local network.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="space-y-1.5 max-w-md">
              <Label className="text-xs">Mode</Label>
              <Select value={lanMode} onValueChange={(v) => setLanMode(v as 'standalone' | 'client')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standalone">Standalone (this PC only)</SelectItem>
                  <SelectItem value="client">Client (connect to LAN server)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {lanMode === 'client' && (
              <div className="space-y-1.5 max-w-md">
                <Label htmlFor="lanUrl" className="text-xs">Server URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="lanUrl"
                    value={lanUrl}
                    onChange={(e) => { setLanUrl(e.target.value); setLanStatus('idle'); }}
                    placeholder="http://192.168.1.50:4000"
                    className="h-9 flex-1"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={testConnection} disabled={lanTesting || !lanUrl}>
                    {lanTesting ? 'Testing…' : 'Test'}
                  </Button>
                </div>
                {lanStatus === 'ok' && <p className="text-[11px] text-primary">✓ Server reachable</p>}
                {lanStatus === 'fail' && <p className="text-[11px] text-destructive">✗ Could not reach server</p>}
              </div>
            )}

            <div className="rounded-md border p-3 bg-muted/30 max-w-md">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">To host the database on a server PC:</strong> on that PC,
                open the <code>server/</code> folder, run <code>npm install</code> then <code>npm start</code>.
                It will print a LAN URL — paste it on each client PC.
              </p>
            </div>

            <div className="flex justify-end max-w-md">
              <Button type="button" size="sm" onClick={saveNetwork} className="gap-1.5">
                <Save className="h-4 w-4" />
                Save Network Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" size="sm" className="gap-1.5">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}