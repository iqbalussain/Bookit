import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { currencySymbols } from '@/types';
import type { Voucher, Payment } from '@/types';
import {
  ArrowUpRight, ArrowDownLeft, Receipt, ArrowLeftRight,
  HandCoins, Landmark, TrendingUp, Clock, Calendar, BookOpen, Package, FileBarChart,
  Edit, Trash2,
} from 'lucide-react';

const voucherCards = [
  { title: 'Payment', desc: 'Record money out to vendors', icon: ArrowUpRight, color: '#FF6B6B', href: '/payments' },
  { title: 'Receipt', desc: 'Record money in from customers', icon: ArrowDownLeft, color: '#4ECDC4', href: '/payments' },
  { title: 'Expenses', desc: 'Record business expenses', icon: Receipt, color: '#9D7BFA', href: '/vouchers/expenses/new' },
  { title: 'Contra', desc: 'Transfer between accounts', icon: ArrowLeftRight, color: '#FFB347', href: '/vouchers/contra/new' },
  { title: 'Loan Given', desc: 'Record loans & advances', icon: HandCoins, color: '#59C7EB', href: '/vouchers/loan-given/new' },
  { title: 'Loan Received', desc: 'Record loans received', icon: Landmark, color: '#FFA726', href: '/vouchers/loan-received/new' },
  { title: 'Journal', desc: 'Non-cash adjustment entries', icon: BookOpen, color: '#7C83FD', href: '/vouchers/journal' },
  { title: 'Item Report', desc: 'Stock & VAT per item', icon: Package, color: '#26C281', href: '/reports/items' },
  { title: 'VAT Return', desc: 'Output vs input VAT for filing', icon: FileBarChart, color: '#E96479', href: '/reports/vat' },
];

export default function VoucherDashboard() {
  const { vouchers, payments, settings, updateVoucher, deleteVoucher, deletePayment } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const currencySymbol = currencySymbols[settings.currency];

  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [editForm, setEditForm] = useState({ date: '', partyName: '', amount: 0, narration: '', reference: '' });

  const openEditVoucher = (v: Voucher) => {
    setEditingVoucher(v);
    setEditForm({
      date: v.date,
      partyName: v.partyName,
      amount: v.amount,
      narration: v.narration || '',
      reference: v.reference || '',
    });
  };

  const saveEditVoucher = () => {
    if (!editingVoucher) return;
    updateVoucher({
      ...editingVoucher,
      date: editForm.date,
      partyName: editForm.partyName,
      amount: editForm.amount,
      narration: editForm.narration,
      reference: editForm.reference,
    });
    toast({ title: 'Voucher updated', description: editingVoucher.number });
    setEditingVoucher(null);
  };

  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  type RecentRow = {
    key: string;
    kind: 'voucher' | 'payment';
    number: string;
    date: string;
    party: string;
    amount: number;
    type: string;
    voucher?: Voucher;
    payment?: Payment;
  };

  const recentVouchers = useMemo<RecentRow[]>(() => {
    const allEntries: RecentRow[] = [
      ...vouchers.map((v) => ({
        key: `v-${v.id}`, kind: 'voucher' as const, number: v.number, date: v.date,
        party: v.partyName, amount: v.amount, type: v.type, voucher: v,
      })),
      ...payments.map((p) => ({
        key: `p-${p.id}`, kind: 'payment' as const,
        number: `${p.invoiceType === 'sales' ? 'REC' : 'PAY'}-${p.id.slice(0, 8)}`,
        date: p.date,
        party: p.invoiceType === 'sales' ? 'Receipt' : 'Payment',
        amount: p.amount,
        type: p.invoiceType === 'sales' ? 'receipt' : 'payment',
        payment: p,
      })),
    ];
    return allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);
  }, [vouchers, payments]);

  const todayTotal = useMemo(() => {
    const vt = vouchers.filter((v) => v.date === today).reduce((s, v) => s + v.amount, 0);
    const pt = payments.filter((p) => p.date === today).reduce((s, p) => s + p.amount, 0);
    return vt + pt;
  }, [vouchers, payments, today]);

  const monthTotal = useMemo(() => {
    const vt = vouchers.filter((v) => v.date >= monthStart).reduce((s, v) => s + v.amount, 0);
    const pt = payments.filter((p) => p.date >= monthStart).reduce((s, p) => s + p.amount, 0);
    return vt + pt;
  }, [vouchers, payments, monthStart]);

  const totalCount = vouchers.length + payments.length;

  const typeBadgeColor: Record<string, string> = {
    expense: 'bg-purple-100 text-purple-700', contra: 'bg-orange-100 text-orange-700',
    loan_given: 'bg-sky-100 text-sky-700', loan_received: 'bg-amber-100 text-amber-700',
    receipt: 'bg-emerald-100 text-emerald-700', payment: 'bg-red-100 text-red-700',
    journal: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Vouchers</h1>
        <p className="text-xs text-muted-foreground">Create and manage all types of vouchers</p>
      </div>

      {/* Gradient Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {voucherCards.map((card) => (
          <Link key={card.title} to={card.href}>
            <Card
              className="border-0 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${card.color}20, ${card.color}40)` }}
            >
              <CardContent className="p-3 lg:p-4">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center mb-2 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${card.color}30` }}
                >
                  <card.icon className="h-5 w-5" style={{ color: card.color }} />
                </div>
                <h3 className="text-sm font-semibold" style={{ color: card.color }}>{card.title}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{card.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase">Today</p>
            <p className="text-sm font-bold">{currencySymbol}{todayTotal.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase">This Month</p>
            <p className="text-sm font-bold">{currencySymbol}{monthTotal.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            <p className="text-sm font-bold">{totalCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Vouchers */}
      {recentVouchers.length > 0 && (
        <Card>
          <CardHeader className="py-2.5 px-3">
            <CardTitle className="text-sm">Recent Vouchers</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-1.5">
              {recentVouchers.map((v) => (
                <div key={v.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium truncate">{v.number}</p>
                      <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${typeBadgeColor[v.type] || ''}`}>
                        {v.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{v.party} • {new Date(v.date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-xs font-semibold">{currencySymbol}{v.amount.toLocaleString('en-IN')}</p>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => {
                        if (v.kind === 'payment') navigate('/payments');
                        else if (v.voucher) openEditVoucher(v.voucher);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {v.number}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the entry and reverses the linked journal. Cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (v.kind === 'payment' && v.payment) deletePayment(v.payment.id);
                              else if (v.voucher) deleteVoucher(v.voucher.id);
                              toast({ title: 'Deleted', description: v.number });
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Voucher Dialog */}
      <Dialog open={!!editingVoucher} onOpenChange={(o) => !o && setEditingVoucher(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Edit Voucher {editingVoucher?.number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Party / Pay To</Label>
              <Input value={editForm.partyName} onChange={(e) => setEditForm({ ...editForm, partyName: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount ({currencySymbol})</Label>
              <Input type="number" min="0" step="0.01" value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) || 0 })}
                className="h-9" />
              <p className="text-[10px] text-muted-foreground">Note: amount edits do not re-post journal entries automatically. Delete and recreate for full re-posting.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reference</Label>
              <Input value={editForm.reference} onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Narration</Label>
              <Textarea value={editForm.narration} onChange={(e) => setEditForm({ ...editForm, narration: e.target.value })} rows={2} className="resize-none text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingVoucher(null)}>Cancel</Button>
            <Button size="sm" onClick={saveEditVoucher}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
