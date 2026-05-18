import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { currencySymbols } from '@/types';
import {
  FileText,
  Receipt,
  Clock,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  ChevronRight,
  Bell,
  ShieldCheck,
  CircleDollarSign,
  Sparkles,
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import LocalInstallationSetup from '@/components/LocalInstallationSetup';

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export default function Dashboard() {
  const {
    quotations,
    invoices,
    purchaseInvoices,
    clients,
    payments,
    settings,
    getClient,
    getCustomers,
    getRecentAuditLog,
  } = useApp();

  const currencySymbol = currencySymbols[settings.currency];
  const today = new Date();
  const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid');
  const outstandingInvoices = invoices.filter((invoice) => invoice.status !== 'paid');
  const overdueInvoices = outstandingInvoices.filter((invoice) => invoice.dueDate && new Date(invoice.dueDate) < today);
  const dueSoonInvoices = outstandingInvoices.filter((invoice) => {
    if (!invoice.dueDate) return false;
    const due = new Date(invoice.dueDate);
    return due >= today && due <= addDays(today, 7);
  });

  const receivableAmount = outstandingInvoices.reduce((sum, invoice) => sum + invoice.netTotal, 0);
  const payableAmount = purchaseInvoices.filter((pi) => pi.status !== 'paid').reduce((sum, pi) => sum + pi.netTotal, 0);
  const revenue = paidInvoices.reduce((sum, invoice) => sum + invoice.netTotal, 0);

  const invoiceMetrics = invoices.map((invoice) => {
    const cost = invoice.items.reduce((sum, item) => sum + (item.cost ?? item.rate * 0.55) * item.quantity, 0);
    return {
      id: invoice.id,
      number: invoice.number,
      margin: invoice.netTotal ? ((invoice.netTotal - cost) / invoice.netTotal) * 100 : 0,
      grossProfit: invoice.netTotal - cost,
    };
  });

  const averageMargin = invoiceMetrics.length
    ? invoiceMetrics.reduce((sum, item) => sum + item.margin, 0) / invoiceMetrics.length
    : 0;

  const lowStockItems = invoices
    .flatMap((invoice) => invoice.items)
    .filter((item) => item.stock !== undefined && item.stock <= (item.reorderLevel ?? 5));

  const upcomingCheques = payments.filter((payment) => {
    const paymentDate = new Date(payment.date);
    return payment.method === 'cheque' && paymentDate > today && paymentDate <= addDays(today, 14);
  });

  const customerInsights = getCustomers()
    .map((customer) => {
      const owed = invoices
        .filter((invoice) => invoice.clientId === customer.id && invoice.status !== 'paid')
        .reduce((sum, invoice) => sum + invoice.netTotal, 0);
      const hasOverdue = invoices.some(
        (invoice) => invoice.clientId === customer.id && invoice.dueDate && new Date(invoice.dueDate) < today && invoice.status !== 'paid',
      );
      return {
        name: customer.name,
        owed,
        overdue: hasOverdue,
      };
    })
    .filter((item) => item.owed > 0)
    .sort((a, b) => b.owed - a.owed)
    .slice(0, 4);

  const healthScore = Math.max(
    40,
    Math.min(
      96,
      Math.round(
        90 - (overdueInvoices.length / Math.max(outstandingInvoices.length, 1)) * 40 - (receivableAmount > Math.max(revenue, 1) ? 6 : 0),
      ),
    ),
  );

  const paymentBehavior = getCustomers()
    .map((customer) => {
      const paid = invoices.filter((invoice) => invoice.clientId === customer.id && invoice.status === 'paid');
      const paymentsForCustomer = payments.filter((payment) => paid.some((invoice) => invoice.id === payment.invoiceId));
      const averageDays = paymentsForCustomer.length
        ? paymentsForCustomer.reduce((sum, payment) => {
            const invoice = paid.find((invoice) => invoice.id === payment.invoiceId);
            if (!invoice) return sum;
            const invoiceDate = new Date(invoice.createdAt);
            const paidDate = new Date(payment.date);
            return sum + Math.max(0, (paidDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / paymentsForCustomer.length
        : 0;
      return {
        name: customer.name,
        averageDays: Math.round(averageDays),
        risk: averageDays > 14 || customer.type === 'customer' ? 'High' : 'Moderate',
      };
    })
    .filter((item) => item.averageDays > 0)
    .sort((a, b) => b.averageDays - a.averageDays)
    .slice(0, 4);

  const auditEntries = getRecentAuditLog(5);

  const trendData = Array.from({ length: 6 }).map((_, index) => {
    const date = addDays(today, -((5 - index) * 6));
    const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const value = invoices
      .filter((invoice) => new Date(invoice.createdAt) <= date)
      .reduce((sum, invoice) => sum + invoice.netTotal, 0);
    return { day, value };
  });

  const formatCurrency = (value: number) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: settings.currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currencySymbol}${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    }
  };

  return (
    <div className="space-y-6">
      <LocalInstallationSetup />

      <div className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-2xl shadow-black/5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Premium Business OS
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome back{settings.name ? `, ${settings.name}` : ''}.</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">Your executive dashboard gives you instant visibility into revenue, receivables, profitability, and operational health.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-3xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Health Score</p>
              <p className="mt-3 text-4xl font-semibold text-foreground">{healthScore}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Balanced liquidity, overdue risk, and payment behavior.</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Revenue</p>
              <p className="mt-3 text-4xl font-semibold text-foreground">{formatCurrency(revenue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Total paid sales</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Outstanding</p>
              <p className="mt-3 text-4xl font-semibold text-foreground">{formatCurrency(receivableAmount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Receivables due now</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-2 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">Revenue trend</CardTitle>
              <p className="text-sm text-muted-foreground">Sales booked over time to help you spot growth and seasonality.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              <CircleDollarSign className="h-4 w-4" /> {invoices.length} invoices
            </div>
          </CardHeader>
          <CardContent className="h-72 px-6 pb-6 pt-2">
            {invoices.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(59 130 246)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="rgb(59 130 246)" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)' }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Until ${label}`} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#revenueGradient)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Add invoices to power your analytics.</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Alerts</CardTitle>
                <p className="text-sm text-muted-foreground">Priority actions to keep operations smooth.</p>
              </div>
              <Badge variant="secondary">Live</Badge>
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-border/60 bg-card/90 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-foreground">
                    <Bell className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Due payments</p>
                      <p className="text-xs text-muted-foreground">{dueSoonInvoices.length} invoices due within 7 days</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(dueSoonInvoices.reduce((sum, invoice) => sum + invoice.netTotal, 0))}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-border/60 bg-card/90 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-foreground">
                    <ShieldCheck className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-semibold">Overdue invoices</p>
                      <p className="text-xs text-muted-foreground">{overdueInvoices.length} invoices overdue</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(overdueInvoices.reduce((sum, invoice) => sum + invoice.netTotal, 0))}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-border/60 bg-card/90 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-foreground">
                    <Sparkles className="h-5 w-5 text-warning" />
                    <div>
                      <p className="text-sm font-semibold">PDC cheque due</p>
                      <p className="text-xs text-muted-foreground">{upcomingCheques.length} cheques arriving in 14 days</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{upcomingCheques.length}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
            <CardHeader className="px-0 pb-4">
              <CardTitle className="text-base">Profitability</CardTitle>
              <p className="text-sm text-muted-foreground">Cost vs selling price insight across invoices.</p>
            </CardHeader>
            <CardContent className="px-0 pt-0">
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-3xl border border-border/60 bg-card/90 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Average margin</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{Math.round(averageMargin)}%</p>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">{invoiceMetrics.length} invoices analysed</div>
                </div>
                <div className="rounded-3xl border border-border/60 bg-card/90 p-4">
                  <p className="text-sm text-muted-foreground">Profit per invoice is estimated from bill of materials and cost fields.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
          <CardHeader className="px-0 pb-4">
            <CardTitle className="text-base">Outstanding customer alerts</CardTitle>
            <p className="text-sm text-muted-foreground">High-risk customers with unpaid balances.</p>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            <div className="space-y-3">
              {customerInsights.length ? (
                customerInsights.map((customer) => (
                  <div key={customer.name} className="flex items-center justify-between rounded-3xl border border-border/60 bg-card/90 p-4">
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.overdue ? 'Overdue account' : 'Open balance'}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(customer.owed)}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-border/60 bg-card/90 p-6 text-sm text-muted-foreground">No high-risk customers found. Keep payment behavior strong.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
            <CardHeader className="px-0 pb-4">
              <CardTitle className="text-base">Customer payment behavior</CardTitle>
              <p className="text-sm text-muted-foreground">Average payment lead time across clients.</p>
            </CardHeader>
            <CardContent className="px-0 pt-0 space-y-3">
              {paymentBehavior.length ? (
                paymentBehavior.map((customer) => (
                  <div key={customer.name} className="rounded-3xl border border-border/60 bg-card/90 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.risk} risk</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{customer.averageDays} days</p>
                        <p className="text-xs text-muted-foreground">to pay</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-border/60 bg-card/90 p-6 text-sm text-muted-foreground">Add payments to track customer behavior.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
            <CardHeader className="px-0 pb-4">
              <CardTitle className="text-base">Activity timeline</CardTitle>
              <p className="text-sm text-muted-foreground">Latest business events and audit entries.</p>
            </CardHeader>
            <CardContent className="px-0 pt-0">
              <div className="space-y-3">
                {auditEntries.length ? (
                  auditEntries.map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-border/60 bg-card/90 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{entry.action.replace(/\b\w/g, (chr) => chr.toUpperCase())} {entry.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{entry.target}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</p>
                      </div>
                      {entry.details && <p className="mt-2 text-sm text-muted-foreground">{entry.details}</p>}
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-border/60 bg-card/90 p-6 text-sm text-muted-foreground">Your activity log will appear here once you start adding documents.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
          <CardHeader className="px-0 pb-4">
            <CardTitle className="text-base">Low stock alerts</CardTitle>
            <p className="text-sm text-muted-foreground">Inventory warnings for items with low or critical stock.</p>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-3xl border border-border/60 bg-card/90 p-4">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Stock: {item.stock ?? 0}</p>
                  </div>
                  <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">Low stock</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
