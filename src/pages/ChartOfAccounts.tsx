import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { Account, AccountNodeKind, AccountType } from '@/types';
import { Plus, Trash2, ChevronRight, ChevronDown, FolderTree } from 'lucide-react';
import { Link } from 'react-router-dom';

const typeColors: Record<AccountType, string> = {
  asset: 'bg-primary/10 text-primary',
  liability: 'bg-destructive/10 text-destructive',
  income: 'bg-success/10 text-success',
  expense: 'bg-warning/10 text-warning',
  equity: 'bg-accent text-accent-foreground',
};

interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
}

const ROOT_GROUP = '__root__';

export default function ChartOfAccounts() {
  const { accounts, addAccount, deleteAccount, getAccountBalance } = useApp();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([ROOT_GROUP]));
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'asset' as AccountType,
    kind: 'ledger' as AccountNodeKind,
    parentId: ROOT_GROUP,
  });

  const groupOptions = useMemo(
    () => accounts.filter((account) => account.kind === 'group').sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  );

  const tree = useMemo(() => {
    const nodeById = new Map<string, AccountTreeNode>();
    accounts.forEach((account) => nodeById.set(account.id, { ...account, children: [] }));

    const roots: AccountTreeNode[] = [];
    nodeById.forEach((node) => {
      if (!node.parentId) {
        roots.push(node);
        return;
      }
      const parent = nodeById.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: AccountTreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach((node) => sortNodes(node.children));
    };

    sortNodes(roots);
    return roots;
  }, [accounts]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast({ title: 'Error', description: 'Code and name are required', variant: 'destructive' });
      return;
    }
    if (accounts.some((account) => account.code === formData.code.trim())) {
      toast({ title: 'Error', description: 'Account code already exists', variant: 'destructive' });
      return;
    }

    const parentId = formData.parentId === ROOT_GROUP ? null : formData.parentId;
    const parent = parentId ? accounts.find((account) => account.id === parentId) : null;

    if (parent && parent.kind !== 'group') {
      toast({ title: 'Error', description: 'Parent must be a group node', variant: 'destructive' });
      return;
    }

    if (parent && parent.type !== formData.type) {
      toast({ title: 'Error', description: 'Parent group type must match account type', variant: 'destructive' });
      return;
    }

    if (formData.kind === 'ledger' && parent?.kind === 'ledger') {
      toast({ title: 'Error', description: 'Ledger accounts cannot be nested under ledger accounts', variant: 'destructive' });
      return;
    }

    const account: Account = {
      id: `acc-${crypto.randomUUID().slice(0, 8)}`,
      code: formData.code.trim(),
      name: formData.name.trim(),
      type: formData.type,
      kind: formData.kind,
      parentId,
      isSystem: false,
    };

    try {
      addAccount(account);
      toast({ title: 'Account added', description: `${account.code} - ${account.name}` });
      setIsDialogOpen(false);
      setFormData({ code: '', name: '', type: 'asset', kind: 'ledger', parentId: ROOT_GROUP });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to add account', variant: 'destructive' });
    }
  };

  const renderNode = (node: AccountTreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const balance = getAccountBalance(node.id);

    return (
      <div key={node.id} className="space-y-1">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group" style={{ marginLeft: `${depth * 14}px` }}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {node.kind === 'group' ? (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleNode(node.id)}>
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </Button>
            ) : (
              <span className="h-6 w-6" />
            )}

            {node.kind === 'ledger' ? (
              <Link to={`/accounts/${node.id}/statement`} className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="text-xs font-mono text-muted-foreground w-11">{node.code}</span>
                <span className="text-sm group-hover:text-primary transition-colors truncate">{node.name}</span>
                {node.isSystem && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">System</Badge>}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-all ml-1" />
              </Link>
            ) : (
              <button type="button" onClick={() => toggleNode(node.id)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground w-11">{node.code}</span>
                <span className="text-sm font-medium truncate">{node.name}</span>
                <Badge variant="outline" className="text-[10px]">Group</Badge>
                {node.isSystem && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">System</Badge>}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {node.kind === 'ledger' && (
              <span className={`text-xs font-medium ${balance >= 0 ? '' : 'text-destructive'}`}>
                {balance !== 0 ? `${balance >= 0 ? 'Dr' : 'Cr'} ${Math.abs(balance).toLocaleString('en-IN')}` : '—'}
              </span>
            )}
            {!node.isSystem && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account</AlertDialogTitle>
                    <AlertDialogDescription>Delete {node.code} - {node.name}?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        try {
                          deleteAccount(node.id);
                        } catch (error) {
                          toast({ title: 'Unable to delete', description: error instanceof Error ? error.message : 'Delete failed', variant: 'destructive' });
                        }
                      }}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const typeLabels: Record<AccountType, string> = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    income: 'Income',
    expense: 'Expenses',
  };

  return (
    <div className="space-y-3 pb-20 lg:pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Grouped account hierarchy</p>
        </div>
        <Button size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Add Account
        </Button>
      </div>

      {(['asset', 'liability', 'equity', 'income', 'expense'] as AccountType[]).map((type) => {
        const roots = tree.filter((node) => node.type === type);
        return (
          <Card key={type}>
            <CardHeader className="py-2.5 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="outline" className={`${typeColors[type]} text-[10px]`}>{typeLabels[type]}</Badge>
                <span className="text-xs text-muted-foreground">({roots.length} root)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {roots.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No accounts</p>
              ) : (
                <div className="space-y-1">{roots.map((root) => renderNode(root))}</div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>Add a group or ledger to your chart</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Code *</Label>
              <Input value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="e.g. 1200" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Account name" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as AccountType })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Node Type</Label>
              <Select value={formData.kind} onValueChange={(value) => setFormData({ ...formData, kind: value as AccountNodeKind })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="ledger">Ledger</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Parent Group</Label>
              <Select value={formData.parentId} onValueChange={(value) => setFormData({ ...formData, parentId: value })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_GROUP}>No Parent (root)</SelectItem>
                  {groupOptions
                    .filter((group) => group.type === formData.type)
                    .map((group) => (
                      <SelectItem key={group.id} value={group.id}>{group.code} — {group.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
