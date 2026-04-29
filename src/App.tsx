import { useEffect, useRef } from "react";
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

import QuotationsList from "./pages/QuotationsList";
import QuotationForm from "./pages/QuotationForm";
import InvoicesList from "./pages/InvoicesList";
import InvoiceForm from "./pages/InvoiceForm";
import PurchaseInvoicesList from "./pages/PurchaseInvoicesList";
import PurchaseInvoiceForm from "./pages/PurchaseInvoiceForm";
import ClientsList from "./pages/ClientsList";
import ClientStatement from "./pages/ClientStatement";
import PaymentForm from "./pages/PaymentForm";
import PaymentsReceipts from "./pages/PaymentsReceipts";
import VoucherDashboard from "./pages/VoucherDashboard";
import ExpensesVoucher from "./pages/ExpensesVoucher";
import ContraVoucher from "./pages/ContraVoucher";
import LoanGivenVoucher from "./pages/LoanGivenVoucher";
import LoanReceivedVoucher from "./pages/LoanReceivedVoucher";
import JournalVoucher from "./pages/JournalVoucher";
import ItemsList from "./pages/ItemsList";
import ItemReport from "./pages/reports/ItemReport";
import VatReturn from "./pages/reports/VatReturn";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import AccountStatement from "./pages/AccountStatement";
import Settings from "./pages/Settings";
import ProfitAndLoss from "./pages/reports/ProfitAndLoss";
import BalanceSheet from "./pages/reports/BalanceSheet";
import TrialBalance from "./pages/reports/TrialBalance";
import AgingReport from "./pages/reports/AgingReport";
import DayBook from "./pages/DayBook";

const queryClient = new QueryClient();

function StorageErrorListener() {
  const { toast } = useToast();
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, isQuota } = (e as CustomEvent).detail ?? {};
      toastRef.current({
        title: isQuota ? "Storage full" : "Could not save data",
        description: message ?? "An unexpected storage error occurred.",
        variant: "destructive",
      });
    };

    window.addEventListener("bookit:storage-error", handler);
    return () => window.removeEventListener("bookit:storage-error", handler);
  }, []);

  useEffect(() => {
    setConflictHandler((collection) => {
      toastRef.current({
        title: "Record changed by another user",
        description: `Your edit on ${collection.replace(
          "/api/records/",
          ""
        )} clashed with a newer change.`,
        variant: "destructive",
      });
    });

    return () => setConflictHandler(null);
  }, []);

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
                    <Route path="/day-book" element={<ErrorBoundary inline><DayBook /></ErrorBoundary>} />
                    <Route path="/settings" element={<ErrorBoundary inline><Settings /></ErrorBoundary>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
              </AppLayout>
            </HashRouter>

          </TooltipProvider>
        </AppProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
