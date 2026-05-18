import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Download, Folder, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * System Diagnostics Component
 * Shows app health, logs, and troubleshooting information
 * Appears in Settings page
 */

export const DiagnosticsPanel: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    setLoading(true);
    try {
      const w = window as any;
      if (w.electron) {
        const info = await w.electron.ipcRenderer.invoke('get-diagnostic-info');
        const logData = await w.electron.ipcRenderer.invoke('get-diagnostic-logs');
        setDiagnostics(info);
        setLogs(Array.isArray(logData) ? logData : []);
      }
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const w = window as any;
      if (w.electron) {
        const result = await w.electron.ipcRenderer.invoke('export-diagnostics');
        if (result.success) {
          alert(`Diagnostics exported to:\n${result.path}`);
        } else if (!result.canceled) {
          alert(`Export failed: ${result.error}`);
        }
      }
    } catch (err) {
      alert(`Error exporting diagnostics: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleOpenLogsFolder = async () => {
    try {
      const w = window as any;
      if (w.electron) {
        const result = await w.electron.ipcRenderer.invoke('open-logs-folder');
        if (result.success) {
          alert(`Logs folder opened:\n${result.path}`);
        } else {
          alert(`Error: ${result.error}`);
        }
      }
    } catch (err) {
      alert(`Error opening logs folder: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!diagnostics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Diagnostics</CardTitle>
          <CardDescription>Loading system information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            System Health
          </CardTitle>
          <CardDescription>Current application status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600 uppercase">Uptime</p>
              <p className="text-lg font-mono">{diagnostics.uptime || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600 uppercase">Total Logs</p>
              <p className="text-lg font-mono">{diagnostics.totalLogs || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600 uppercase">Warnings</p>
              <p className={`text-lg font-mono ${diagnostics.warnings > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {diagnostics.warnings || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600 uppercase">Errors</p>
              <p className={`text-lg font-mono ${diagnostics.errors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {diagnostics.errors || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {diagnostics.errors > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {diagnostics.errors} error(s) detected. Please review logs for details.
          </AlertDescription>
        </Alert>
      )}

      {diagnostics.warnings > 0 && (
        <Alert variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {diagnostics.warnings} warning(s) found. Application may work with reduced functionality.
          </AlertDescription>
        </Alert>
      )}

      {diagnostics.errors === 0 && diagnostics.warnings === 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            All systems operational. No errors or warnings detected.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
          <CardDescription>Export logs and open diagnostic folders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              onClick={handleOpenLogsFolder}
              variant="outline"
              className="w-full justify-start"
              disabled={loading}
            >
              <Folder className="mr-2 h-4 w-4" />
              Open Logs Folder
            </Button>
            <Button
              onClick={handleExportLogs}
              variant="outline"
              className="w-full justify-start"
              disabled={loading}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Diagnostics Log
            </Button>
            <Button
              onClick={loadDiagnostics}
              variant="outline"
              className="w-full justify-start"
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Activity Log</CardTitle>
              <CardDescription>Last 20 log entries</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? 'Hide' : 'Show'}
            </Button>
          </div>
        </CardHeader>
        {showLogs && (
          <CardContent>
            <div className="max-h-64 overflow-y-auto rounded-md bg-gray-900 p-3 font-mono text-xs text-gray-100">
              {logs.length > 0 ? (
                logs.slice(-20).map((log, idx) => (
                  <div key={idx} className="whitespace-pre-wrap break-words py-0.5">
                    {log}
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No logs available</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Offline Issues:</strong> Check database location and file permissions in logs
          </p>
          <p>
            <strong>LAN Connection Failed:</strong> Verify server URL in Network settings
          </p>
          <p>
            <strong>Performance Slow:</strong> Close other applications and check available disk space
          </p>
          <p>
            <strong>Export Logs:</strong> Click "Export Diagnostics" button above and share the file
          </p>
          <p className="text-xs text-gray-600 mt-4">
            Logs location: <code className="bg-gray-100 px-1">%LOCALAPPDATA%\bookit\logs\</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosticsPanel;
