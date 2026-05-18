import { ReactNode, useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  Settings,
  ShoppingCart,
  BookOpen,
  BarChart3,
  Menu,
  X,
  Wallet,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Quotations', href: '/quotations', icon: FileText },
  { name: 'Sales', href: '/invoices', icon: Receipt },
  { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
  { name: 'Vouchers', href: '/vouchers', icon: Wallet },
  { name: 'Parties', href: '/clients', icon: Users },
  { name: 'Accounts', href: '/accounts', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const reportSubmenuItems = [
  { name: 'Profit & Loss', href: '/reports/pnl', icon: BarChart3 },
  { name: 'Balance Sheet', href: '/reports/balance-sheet', icon: BarChart3 },
  { name: 'Trial Balance', href: '/reports/trial-balance', icon: BarChart3 },
  { name: 'Aging Report', href: '/reports/aging', icon: BarChart3 },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(location.pathname.startsWith('/reports'));
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setReportsOpen(location.pathname.startsWith('/reports'));
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const getIsActive = (href: string | null) => {
    if (!href) return false;
    return location.pathname === href || (href !== '/' && location.pathname.startsWith(href));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="lg:flex lg:min-h-screen">
        <aside className="hidden lg:flex lg:w-80 shrink-0 flex-col border-r border-border/70 bg-sidebar/95 p-6 shadow-xl shadow-black/5 backdrop-blur-xl">
          <Link to="/" className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">BookIt OS</p>
              <p className="text-lg font-semibold tracking-tight">Business HQ</p>
            </div>
          </Link>

          <div className="space-y-5">
            <div className="rounded-3xl border border-border/70 bg-white/85 p-4 shadow-sm shadow-black/5 ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/75 dark:ring-white/10">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Workspace</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Modern business operations and financial intelligence.</p>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const active = getIsActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href || '/'}
                    className={cn(
                      'group flex items-center gap-3 rounded-3xl px-4 py-3 transition-all duration-200',
                      active
                        ? 'bg-primary text-primary-foreground shadow-primary/15 ring-1 ring-primary/20'
                        : 'border border-border/50 bg-background text-foreground hover:border-primary/70 hover:bg-primary/10',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                );
              })}

              <div className="rounded-3xl border border-border/70 bg-background/90 p-3 shadow-sm shadow-black/5">
                <button
                  type="button"
                  onClick={() => setReportsOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-2 text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Reports
                  </span>
                  <ArrowRight className={cn('h-4 w-4 transition-transform duration-200', reportsOpen && 'rotate-90')} />
                </button>
                {reportsOpen && (
                  <div className="mt-3 space-y-2 pl-2">
                    {reportSubmenuItems.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition-colors',
                          getIsActive(item.href)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="mt-auto rounded-3xl border border-border/60 bg-white/80 p-4 shadow-sm shadow-black/5 backdrop-blur-xl dark:bg-slate-950/70 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Theme</p>
                <p className="mt-1 text-sm font-semibold">Premium glass mode</p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-card text-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground"
              >
                {mounted && theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur-xl lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-card text-foreground shadow-sm transition hover:border-primary hover:text-primary"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Premium Operations</p>
                  <h2 className="text-xl font-semibold">Enterprise-grade business dashboard</h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to="/quotations/new" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> New Quote
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/invoices/new" className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" /> New Invoice
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          {sidebarOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-start bg-black/30 p-4 lg:hidden">
              <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-background p-6 shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Menu</p>
                    <p className="text-lg font-semibold">Navigation</p>
                  </div>
                  <button type="button" onClick={() => setSidebarOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-card text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href || '/'}
                      className={cn(
                        'flex items-center gap-3 rounded-3xl px-4 py-3 transition',
                        getIsActive(item.href)
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border/70 bg-card text-foreground hover:bg-primary/10',
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          )}

          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
