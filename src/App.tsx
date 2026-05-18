import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { setConflictHandler } from "@/lib/apiClient";

import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const QuotationsList = lazy(() => import("./pages/QuotationsList"));
const QuotationForm = lazy(() => import("./pages/QuotationForm"));
const InvoicesList = lazy(() => import("./pages/InvoicesList"));
const InvoiceForm = lazy(() => import("./pages/InvoiceForm"));
const PurchaseInvoicesList = lazy(() => import("./pages/PurchaseInvoicesList"));
const PurchaseInvoiceForm = lazy(() => import("./pages/PurchaseInvoiceForm"));
const ClientsList = lazy(() => import("./pages/ClientsList"));
const ClientStatement = lazy(() => import("./pages/ClientStatement"));
const PaymentForm = lazy(() => import("./pages/PaymentForm"));
const PaymentsReceipts = lazy(() => import("./pages/PaymentsReceipts"));
const VoucherDashboard = lazy(() => import("./pages/VoucherDashboard"));
const ExpensesVoucher = lazy(() => import("./pages/ExpensesVoucher"));
const ContraVoucher = lazy(() => import("./pages/ContraVoucher"));
const LoanGivenVoucher = lazy(() => import("./pages/LoanGivenVoucher"));
const LoanReceivedVoucher = lazy(() => import("./pages/LoanReceivedVoucher"));
const JournalVoucher = lazy(() => import("./pages/JournalVoucher"));
const ItemsList = lazy(() => import("./pages/ItemsList"));
const ItemReport = lazy(() => import("./pages/reports/ItemReport"));
const VatReturn = lazy(() => import("./pages/reports/VatReturn"));
const ChartOfAccounts = lazy(() => import("./pages/ChartOfAccounts"));
const AccountStatement = lazy(() => import("./pages/AccountStatement"));
const Settings = lazy(() => import("./pages/Settings"));
const ProfitAndLoss = lazy(() => import("./pages/reports/ProfitAndLoss"));
const BalanceSheet = lazy(() => import("./pages/reports/BalanceSheet"));
const TrialBalance = lazy(() => import("./pages/reports/TrialBalance"));
const AgingReport = lazy(() => import("./pages/reports/AgingReport"));

const queryClient = new QueryClient();

function StorageErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, isQuota } = (e as CustomEvent).detail ?? {};
      toast({
        title: isQuota ? "Storage full" : "Could not save data",
        description: message ?? "An unexpected storage error occurred.",
        variant: "destructive",
      });
    };

    window.addEventListener("bookit:storage-error", handler);
    return () => window.removeEventListener("bookit:storage-error", handler);
  }, [toast]);

  useEffect(() => {
    setConflictHandler((collection) => {
      toast({
        title: "Record changed by another user",
        description: `Your edit on ${collection.replace(
          "/api/records/",
          ""
        )} clashed with a newer change.`,
        variant: "destructive",
      });
    });
  }, [toast]);

  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <StorageErrorListener />

            {/* IMPORTANT: HashRouter for Electron */}
            <HashRouter>
              <AppLayout>
                <Suspense fallback={<div className="flex items-center justify-center h-full w-full">Loading…</div>}>
                  <Routes>
                    <Route path="/" element={<ErrorBoundary inline><Dashboard /></ErrorBoundary>} />
                    <Route path="/quotations" element={<ErrorBoundary inline><QuotationsList /></ErrorBoundary>} />
                    <Route path="/quotations/new" element={<ErrorBoundary inline><QuotationForm /></ErrorBoundary>} />
                    <Route path="/quotations/:id" element={<ErrorBoundary inline><QuotationForm /></ErrorBoundary>} />
                    <Route path="/invoices" element={<ErrorBoundary inline><InvoicesList /></ErrorBoundary>} />
                    <Route path="/invoices/new" element={<ErrorBoundary inline><InvoiceForm /></ErrorBoundary>} />
                    <Route path="/invoices/:id" element={<ErrorBoundary inline><InvoiceForm /></ErrorBoundary>} />
                    <Route path="/invoices/:id/payment" element={<ErrorBoundary inline><PaymentForm /></ErrorBoundary>} />
                    <Route path="/purchases" element={<ErrorBoundary inline><PurchaseInvoicesList /></ErrorBoundary>} />
                    <Route path="/purchases/new" element={<ErrorBoundary inline><PurchaseInvoiceForm /></ErrorBoundary>} />
                    <Route path="/purchases/:id" element={<ErrorBoundary inline><PurchaseInvoiceForm /></ErrorBoundary>} />
                    <Route path="/payments" element={<ErrorBoundary inline><PaymentsReceipts /></ErrorBoundary>} />
                    <Route path="/vouchers" element={<ErrorBoundary inline><VoucherDashboard /></ErrorBoundary>} />
                    <Route path="/vouchers/expenses/new" element={<ErrorBoundary inline><ExpensesVoucher /></ErrorBoundary>} />
                    <Route path="/vouchers/contra/new" element={<ErrorBoundary inline><ContraVoucher /></ErrorBoundary>} />
                    <Route path="/vouchers/loan-given/new" element={<ErrorBoundary inline><LoanGivenVoucher /></ErrorBoundary>} />
                    <Route path="/vouchers/loan-received/new" element={<ErrorBoundary inline><LoanReceivedVoucher /></ErrorBoundary>} />
                    <Route path="/vouchers/journal" element={<ErrorBoundary inline><JournalVoucher /></ErrorBoundary>} />
                    <Route path="/items" element={<ErrorBoundary inline><ItemsList /></ErrorBoundary>} />
                    <Route path="/clients" element={<ErrorBoundary inline><ClientsList /></ErrorBoundary>} />
                    <Route path="/clients/:id/statement" element={<ErrorBoundary inline><ClientStatement /></ErrorBoundary>} />
                    <Route path="/accounts" element={<ErrorBoundary inline><ChartOfAccounts /></ErrorBoundary>} />
                    <Route path="/accounts/:id/statement" element={<ErrorBoundary inline><AccountStatement /></ErrorBoundary>} />
                    <Route path="/reports/pnl" element={<ErrorBoundary inline><ProfitAndLoss /></ErrorBoundary>} />
                    <Route path="/reports/balance-sheet" element={<ErrorBoundary inline><BalanceSheet /></ErrorBoundary>} />
                    <Route path="/reports/trial-balance" element={<ErrorBoundary inline><TrialBalance /></ErrorBoundary>} />
                    <Route path="/reports/aging" element={<ErrorBoundary inline><AgingReport /></ErrorBoundary>} />
                    <Route path="/reports/items" element={<ErrorBoundary inline><ItemReport /></ErrorBoundary>} />
                    <Route path="/reports/vat" element={<ErrorBoundary inline><VatReturn /></ErrorBoundary>} />
                    <Route path="/settings" element={<ErrorBoundary inline><Settings /></ErrorBoundary>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </HashRouter>

          </TooltipProvider>
        </AppProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;