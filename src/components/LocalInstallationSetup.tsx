import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useElectron } from '@/hooks/useElectron';
import {
  Download,
  Server,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Settings,
  Database,
} from 'lucide-react';

export default function LocalInstallationSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isElectron } = useElectron();
  const [lanMode, setLanMode] = useState<'standalone' | 'client'>('standalone');
  const [lanUrl, setLanUrl] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mode = (localStorage.getItem('lan.mode') || 'standalone') as 'standalone' | 'client';
      const url = localStorage.getItem('lan.serverUrl') || '';
      setLanMode(mode);
      setLanUrl(url);
      setIsConfigured(mode === 'standalone' || (mode === 'client' && url.trim() !== ''));
    }
  }, []);

  const handleDownloadApp = () => {
    toast({
      title: 'Download available',
      description: 'Redirecting to download page. You can also use this web version for instant access.',
    });
    // Open the releases page or download link
    window.open('https://github.com/iqbalussain/bookit/releases', '_blank');
  };

  const handleConfigureLocal = () => {
    navigate('/settings');
    toast({
      title: 'Network settings',
      description: 'Configure your local server connection in Settings → Network.',
    });
  };

  if (isConfigured && lanMode === 'standalone') {
    return null;
  }

  if (isConfigured && lanMode === 'client' && lanUrl) {
    return (
      <Card className="rounded-3xl border-2 border-primary/30 bg-primary/5 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Network Mode Connected</CardTitle>
            </div>
            <CardDescription>Connected to local network server</CardDescription>
          </div>
          <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">Connected</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3 rounded-2xl border border-primary/30 bg-white/50 p-3 text-sm">
              <Server className="h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Server URL</p>
                <p className="text-xs font-mono text-muted-foreground break-all">{lanUrl}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-primary/30 bg-white/50 p-3 text-sm">
              <Clock className="h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Multi-User Support</p>
                <p className="text-xs text-muted-foreground">Share data with team members on the same network</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleConfigureLocal}
            >
              <Settings className="h-4 w-4" />
              Modify Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not configured or first time
  return (
    <Card className="rounded-3xl border-2 border-amber-300 bg-amber-50/50 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">Setup Required</CardTitle>
          </div>
          <CardDescription>Choose how you want to use BookIt</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-amber-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Option 1: Local (Standalone)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Store all data locally on this device. Perfect for single users. Data is not synced anywhere.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-amber-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <Server className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Option 2: Network (Multi-User)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect to a local network server to share data with team members. Requires a server to be running.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="gap-2 bg-amber-600 hover:bg-amber-700"
            onClick={handleConfigureLocal}
          >
            <Settings className="h-4 w-4" />
            Configure Now
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground bg-white/50 rounded-lg p-2">
          💡 Tip: The desktop app works offline and provides better performance. You can run a local server for multi-user access.
        </p>
      </CardContent>
    </Card>
  );
}
