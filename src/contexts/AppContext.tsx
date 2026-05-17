import React, { createContext, useContext, ReactNode, useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSupabaseTable } from '@/hooks/useSupabaseTable';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fromDb, toDb } from '@/lib/dbCase';
import type {
  Account,
  AuditEntry,
  Client,
  Item,
  Invoice,
  JournalEntry,
  Payment,
  Project,
  BusinessSettings,
  Company,
  PurchaseInvoice,
  Quotation,
  Salesman,
  Voucher,
  VoucherType,
} from '@/types';
import { DEFAULT_ACCOUNTS } from '@/types';
import { buildBalancesFromJournalEntries, getNetBalanceForAccount, type AccountBalanceStore } from '@/lib/accounting';
import {
  buildSalesInvoicePostingEntry,
  repostSalesInvoice as buildSalesInvoiceRepostEntries,
} from '@/lib/postingEngine';

interface AppContextType {
  clients: Client[];
  quotations: Quotation[];
  invoices: Invoice[];
  purchaseInvoices: PurchaseInvoice[];
  payments: Payment[];
  projects: Project[];
  items: Item[];
  salesmen: Salesman[];
  accounts: Account[];
  vouchers: Voucher[];
  journalEntries: JournalEntry[];
  accountBalances: AccountBalanceStore;
  settings: BusinessSettings;
  companies: Company[];
  selectedCompanyId: string;
  isElectron: boolean;

  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setQuotations: React.Dispatch<React.SetStateAction<Quotation[]>>;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  setPurchaseInvoices: React.Dispatch<React.SetStateAction<PurchaseInvoice[]>>;
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setSettings: React.Dispatch<React.SetStateAction<BusinessSettings>>;
  setSelectedCompanyId: React.Dispatch<React.SetStateAction<string>>;

  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  getClient: (id?: string) => Client | undefined;
  getCustomers: () => Client[];
  getVendors: () => Client[];

  addQuotation: (quotation: Quotation) => void;
  updateQuotation: (quotation: Quotation) => void;
  deleteQuotation: (id: string) => void;
  generateQuotationNumber: () => string;

  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  generateInvoiceNumber: () => string;
  calculateInvoicePaymentStatus: (invoiceId: string) => Invoice['status'];

  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  getProject: (id?: string) => Project | undefined;

  addPurchaseInvoice: (invoice: PurchaseInvoice) => void;
  updatePurchaseInvoice: (invoice: PurchaseInvoice) => void;
  deletePurchaseInvoice: (id: string) => void;
  generatePurchaseInvoiceNumber: () => string;

  addPayment: (payment: Payment) => void;

  addItem: (item: Item) => void;
  updateItem: (item: Item) => void;
  deleteItem: (id: string) => void;
  adjustItemStock: (id: string, delta: number) => void;

  addSalesman: (salesman: Salesman) => void;
  getSalesman: (id?: string) => Salesman | undefined;

  addAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  getAccountBalance: (id: string) => number;

  addVoucher: (voucher: Voucher) => void;
  addJournalVoucher: (voucher: Voucher, lines: JournalEntry['lines']) => void;
  generateVoucherNumber: (type: VoucherType) => string;
  postTransactionEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt'> & Partial<Pick<JournalEntry, 'id' | 'createdAt'>>) => void;
  createJournalEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt'> & Partial<Pick<JournalEntry, 'id' | 'createdAt'>>) => void;
  postSalesInvoice: (invoice: Invoice) => void;
  repostSalesInvoice: (before: Invoice, after: Invoice) => void;

  createCompany: (name: string) => void;
  updateCompany: (id: string, name: string) => void;
  deleteCompany: (id: string) => void;
  forceSync: () => Promise<void>;

  getRecentAuditLog: (limit?: number) => any[];
}

const defaultSettings: BusinessSettings = {
  name: '',
  email: '',
  phone: '',
  address: '',
  currency: 'INR',
  theme: 'system',
  vatEnabled: true,
  defaultVatPercentage: 5,
  bankName: '',
  bankAccountNumber: '',
};

const AppContext = createContext<AppContextType | null>(null);
const defaultCompanies: Company[] = [{ id: 'default', name: 'Default Company' }];

const safeArray = <T,>(arr: T[] | undefined | null): T[] => (Array.isArray(arr) ? arr : []);

const recalculateProjects = (projects: Project[], invoices: Invoice[]): Project[] =>
  safeArray(projects).map((project) => {
    const linkedInvoices = safeArray(invoices).filter(
      (invoice) => invoice.projectId === project.id && invoice.status !== 'cancelled'
    );
    const totalInvoicedAmount = linkedInvoices.reduce((sum, invoice) => sum + (Number(invoice.netTotal) || 0), 0);
    const totalInvoicedPercentage = linkedInvoices.reduce(
      (sum, invoice) => sum + (Number(invoice.totalPercentage) || 0),
      0
    );
    return {
      ...project,
      totalInvoicedAmount,
      totalInvoicedPercentage,
      remainingAmount: Math.max(0, (Number(project.totalValue) || 0) - totalInvoicedAmount),
      remainingPercentage: Math.max(0, 100 - totalInvoicedPercentage),
      linkedInvoiceIds: linkedInvoices.map((invoice) => invoice.id),
    };
  });

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, user } = useAuth();
  const ready = !!user;

  const [clients, setClients] = useSupabaseTable<Client>('clients', { ready, initial: [] });
  const [quotations, setQuotations] = useSupabaseTable<Quotation>('quotations', { ready, jsonbCols: ['items'], initial: [] });
  const [invoices, setInvoices] = useSupabaseTable<Invoice>('invoices', { ready, jsonbCols: ['items', 'project_summary'], initial: [] });
  const [purchaseInvoices, setPurchaseInvoices] = useSupabaseTable<PurchaseInvoice>('purchase_invoices', { ready, jsonbCols: ['items'], initial: [] });
  const [payments, setPayments] = useSupabaseTable<Payment>('payments', { ready, initial: [] });
  const [projects, setProjects] = useSupabaseTable<Project>('projects', { ready, jsonbCols: ['activities', 'linked_invoice_ids'], initial: [] });
  const [items, setItems] = useSupabaseTable<Item>('items', { ready, initial: [] });
  const [salesmen, setSalesmen] = useSupabaseTable<Salesman>('salesmen', { ready, initial: [] });
  const [vouchers, setVouchers] = useSupabaseTable<Voucher>('vouchers', { ready, jsonbCols: ['details'], initial: [] });
  const [journalEntries, setJournalEntries] = useSupabaseTable<JournalEntry>('journal_entries', { ready, jsonbCols: ['lines'], initial: [] });
  const [companies, setCompanies] = useSupabaseTable<Company>('companies', {
    ready,
    initial: [],
    onFirstLoad: async (rows) => {
      if (rows.length === 0 && user) {
        await (supabase.from as any)('companies').insert({ id: 'default', name: 'Default Company' });
      }
    },
  });
  const [accounts, setAccounts] = useSupabaseTable<Account>('accounts', {
    ready,
    initial: DEFAULT_ACCOUNTS,
    onFirstLoad: async (rows) => {
      if (rows.length === 0 && user) {
        await (supabase.from as any)('accounts').insert(DEFAULT_ACCOUNTS.map((a) => toDb(a)));
      }
    },
  });

  // Audit log: local only (low value to round-trip)
  const [auditLog, setAuditLog] = useLocalStorage<AuditEntry[]>('app_audit_log', []);
  const [selectedCompanyId, setSelectedCompanyId] = useLocalStorage<string>('app_selected_company', 'default');

  // Settings: singleton row per user
  const [settings, setSettingsState] = useState<BusinessSettings>(defaultSettings);
  const settingsLoadedRef = useRef(false);
  const settingsRowIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.from as any)('business_settings').select('*').limit(1).maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn('[supabase] settings load:', error.message);
      }
      if (data) {
        settingsRowIdRef.current = data.id;
        setSettingsState({ ...defaultSettings, ...fromDb<BusinessSettings>(data) });
      }
      settingsLoadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const setSettings: React.Dispatch<React.SetStateAction<BusinessSettings>> = useCallback((next) => {
    setSettingsState((prev) => {
      const computed = typeof next === 'function' ? (next as (p: BusinessSettings) => BusinessSettings)(prev) : next;
      if (ready && settingsLoadedRef.current) {
        const payload: any = toDb(computed);
        const existingId = settingsRowIdRef.current;
        if (existingId) {
          (supabase.from as any)('business_settings')
            .update(payload)
            .eq('id', existingId)
            .then(({ error }: any) => {
              if (error) console.warn('[supabase] settings update:', error.message);
            });
        } else {
          (supabase.from as any)('business_settings')
            .insert(payload)
            .select('id')
            .single()
            .then(({ data, error }: any) => {
              if (error) console.warn('[supabase] settings insert:', error.message);
              else if (data?.id) settingsRowIdRef.current = data.id;
            });
        }
      }
      return computed;
    });
  }, [ready]);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const accountBalances = useMemo(
    () => buildBalancesFromJournalEntries(safeArray(journalEntries)),
    [journalEntries]
  );

  const addAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'createdAt'>) => {
    setAuditLog((prev) => [
      { id: Date.now().toString(), createdAt: new Date().toISOString(), ...entry },
      ...safeArray(prev),
    ]);
  }, [setAuditLog]);

  const addClient = useCallback((client: Client) => {
    setClients((prev) => [...safeArray(prev), client]);
    addAudit({ type: 'client', action: 'created', target: client.name });
  }, [addAudit, setClients]);

  const updateClient = useCallback((client: Client) => {
    setClients((prev) => safeArray(prev).map((c) => (c.id === client.id ? client : c)));
    addAudit({ type: 'client', action: 'updated', target: client.name });
  }, [addAudit, setClients]);

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => safeArray(prev).filter((c) => c.id !== id));
  }, [setClients]);

  const getClient = useCallback((id?: string) => safeArray(clients).find((c) => c.id === id), [clients]);

  const getCustomers = useCallback(() => {
    return safeArray(clients).filter((c) => c.type === 'customer' || c.type === 'both');
  }, [clients]);

  const getVendors = useCallback(() => {
    return safeArray(clients).filter((c) => c.type === 'vendor' || c.type === 'both');
  }, [clients]);

  const getSalesman = useCallback((id?: string) => safeArray(salesmen).find((s) => s.id === id), [salesmen]);
  const getProject = useCallback((id?: string) => safeArray(projects).find((p) => p.id === id), [projects]);

  const nextNumber = useCallback((prefix: string, existing: Array<{ number?: string }>) => {
    const max = safeArray(existing).reduce((highest, item) => {
      const match = item.number?.match(/(\d+)$/);
      return match ? Math.max(highest, Number(match[1]) || 0) : highest;
    }, 0);
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }, []);

  const generateQuotationNumber = useCallback(() => nextNumber('QT', quotations), [nextNumber, quotations]);
  const generateInvoiceNumber = useCallback(() => nextNumber('INV', invoices), [nextNumber, invoices]);
  const generatePurchaseInvoiceNumber = useCallback(() => nextNumber('PI', purchaseInvoices), [nextNumber, purchaseInvoices]);
  const generateVoucherNumber = useCallback((type: VoucherType) => nextNumber(type.toUpperCase(), vouchers), [nextNumber, vouchers]);

  const addQuotation = useCallback((quotation: Quotation) => {
    setQuotations((prev) => [...safeArray(prev), quotation]);
    addAudit({ type: 'quotation', action: 'created', target: quotation.number, value: quotation.netTotal });
  }, [addAudit, setQuotations]);

  const updateQuotation = useCallback((quotation: Quotation) => {
    setQuotations((prev) => safeArray(prev).map((q) => (q.id === quotation.id ? quotation : q)));
    addAudit({ type: 'quotation', action: 'updated', target: quotation.number, value: quotation.netTotal });
  }, [addAudit, setQuotations]);

  const deleteQuotation = useCallback((id: string) => {
    setQuotations((prev) => safeArray(prev).filter((q) => q.id !== id));
  }, [setQuotations]);

  const addInvoice = useCallback((invoice: Invoice) => {
    const safeInvoice = {
      ...invoice,
      items: Array.isArray(invoice.items) ? invoice.items : [],
      netTotal: Number(invoice.netTotal) || 0,
      createdAt: invoice.createdAt || new Date().toISOString(),
      updatedAt: invoice.updatedAt || new Date().toISOString(),
    };

    const nextInvoices = [...safeArray(invoices), safeInvoice as Invoice];
    setInvoices(nextInvoices);
    setProjects((prevProjects) => recalculateProjects(prevProjects, nextInvoices));
    addAudit({ type: 'invoice', action: 'created', target: safeInvoice.number, value: safeInvoice.netTotal });
  }, [addAudit, invoices, setInvoices, setProjects]);

  const updateInvoice = useCallback((invoice: Invoice) => {
    const nextInvoices = safeArray(invoices).map((i) => (i.id === invoice.id ? invoice : i));
    setInvoices(nextInvoices);
    setProjects((prevProjects) => recalculateProjects(prevProjects, nextInvoices));
    addAudit({ type: 'invoice', action: 'updated', target: invoice.number, value: invoice.netTotal });
  }, [addAudit, invoices, setInvoices, setProjects]);

  const deleteInvoice = useCallback((id: string) => {
    const nextInvoices = safeArray(invoices).filter((i) => i.id !== id);
    setInvoices(nextInvoices);
    setProjects((prevProjects) => recalculateProjects(prevProjects, nextInvoices));
  }, [invoices, setInvoices, setProjects]);

  const addProject = useCallback((project: Project) => {
    setProjects((prev) => recalculateProjects([...safeArray(prev), project], invoices));
    addAudit({ type: 'settings', action: 'created', target: `Project ${project.name}`, value: project.totalValue });
  }, [addAudit, invoices, setProjects]);

  const updateProject = useCallback((project: Project) => {
    setProjects((prev) => recalculateProjects(safeArray(prev).map((p) => (p.id === project.id ? project : p)), invoices));
    addAudit({ type: 'settings', action: 'updated', target: `Project ${project.name}`, value: project.totalValue });
  }, [addAudit, invoices, setProjects]);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => safeArray(prev).filter((p) => p.id !== id));
  }, [setProjects]);

  const addPurchaseInvoice = useCallback((invoice: PurchaseInvoice) => {
    setPurchaseInvoices((prev) => [...safeArray(prev), invoice]);
    addAudit({ type: 'purchase_invoice', action: 'created', target: invoice.number, value: invoice.netTotal });
  }, [addAudit, setPurchaseInvoices]);

  const updatePurchaseInvoice = useCallback((invoice: PurchaseInvoice) => {
    setPurchaseInvoices((prev) => safeArray(prev).map((i) => (i.id === invoice.id ? invoice : i)));
    addAudit({ type: 'purchase_invoice', action: 'updated', target: invoice.number, value: invoice.netTotal });
  }, [addAudit, setPurchaseInvoices]);

  const deletePurchaseInvoice = useCallback((id: string) => {
    setPurchaseInvoices((prev) => safeArray(prev).filter((i) => i.id !== id));
  }, [setPurchaseInvoices]);

  const addPayment = useCallback((payment: Payment) => {
    const safePayment = {
      ...payment,
      amount: Number(payment.amount) || 0,
      date: payment.date || new Date().toISOString().slice(0, 10),
    };

    setPayments((prev) => [...safeArray(prev), safePayment as Payment]);
    addAudit({ type: 'payment', action: 'created', target: safePayment.invoiceId, value: safePayment.amount });
  }, [addAudit, setPayments]);

  const calculateInvoicePaymentStatus = useCallback((invoiceId: string): Invoice['status'] => {
    const invoice = safeArray(invoices).find((i) => i.id === invoiceId);
    const purchase = safeArray(purchaseInvoices).find((i) => i.id === invoiceId);
    const total = Number(invoice?.netTotal ?? purchase?.netTotal) || 0;
    const paid = safeArray(payments)
      .filter((p) => p.invoiceId === invoiceId)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (total > 0 && paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    
    // For project invoices, approvalStatus 'paid' check
    if (invoice?.approvalStatus === 'paid') return 'paid';

    return invoice?.status === 'draft' ? 'draft' : 'sent';
  }, [invoices, payments, purchaseInvoices]);

  const addItem = useCallback((item: Item) => {
    setItems((prev) => [...safeArray(prev), item]);
  }, [setItems]);

  const updateItem = useCallback((item: Item) => {
    setItems((prev) => safeArray(prev).map((i) => (i.id === item.id ? item : i)));
  }, [setItems]);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => safeArray(prev).filter((i) => i.id !== id));
  }, [setItems]);

  const adjustItemStock = useCallback((id: string, delta: number) => {
    setItems((prev) => safeArray(prev).map((item) =>
      item.id === id ? { ...item, stock: (Number(item.stock) || 0) + delta } : item
    ));
  }, [setItems]);

  const addSalesman = useCallback((salesman: Salesman) => {
    setSalesmen((prev) => [...safeArray(prev), salesman]);
  }, [setSalesmen]);

  const addAccount = useCallback((account: Account) => {
    setAccounts((prev) => [...safeArray(prev), account]);
  }, [setAccounts]);

  const deleteAccount = useCallback((id: string) => {
    setAccounts((prev) => safeArray(prev).filter((a) => a.id !== id && a.parentId !== id));
  }, [setAccounts]);

  const getAccountBalance = useCallback((id: string) => {
    const accountsById = new Map(safeArray(accounts).map((account) => [account.id, account]));
    return getNetBalanceForAccount(id, accountsById, accountBalances);
  }, [accountBalances, accounts]);

  const postTransactionEntry = useCallback((entry: Omit<JournalEntry, 'id' | 'createdAt'> & Partial<Pick<JournalEntry, 'id' | 'createdAt'>>) => {
    const now = new Date().toISOString();
    const finalEntry: JournalEntry = {
      ...entry,
      id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: entry.createdAt || now,
    };
    setJournalEntries((prev) => {
      const list = safeArray(prev);
      if (finalEntry.idempotencyKey && list.some((item) => item.idempotencyKey === finalEntry.idempotencyKey)) {
        return list;
      }
      return [...list, finalEntry];
    });
  }, [setJournalEntries]);

  const createJournalEntry = postTransactionEntry;

  const postSalesInvoice = useCallback((invoice: Invoice) => {
    postTransactionEntry(buildSalesInvoicePostingEntry(invoice));
  }, [postTransactionEntry]);

  const repostSalesInvoice = useCallback((before: Invoice, after: Invoice) => {
    const existing = safeArray(journalEntries).filter((entry) =>
      entry.referenceType === 'sales_invoice' && entry.referenceId === before.id && !entry.reversalOf
    );
    const entries = buildSalesInvoiceRepostEntries(before, after, existing);
    entries.forEach(postTransactionEntry);
  }, [journalEntries, postTransactionEntry]);

  const addVoucher = useCallback((voucher: Voucher) => {
    setVouchers((prev) => [...safeArray(prev), voucher]);
    addAudit({ type: 'voucher', action: 'created', target: voucher.number, value: voucher.amount });
  }, [addAudit, setVouchers]);

  const addJournalVoucher = useCallback((voucher: Voucher, lines: JournalEntry['lines']) => {
    addVoucher(voucher);
    postTransactionEntry({
      date: voucher.date,
      reference: voucher.number,
      referenceType: 'journal',
      referenceId: voucher.id,
      description: voucher.narration,
      lines,
      idempotencyKey: `journal:${voucher.id}`,
    });
  }, [addVoucher, postTransactionEntry]);

  const getRecentAuditLog = useCallback((limit = 10) => {
    return safeArray(auditLog).slice(0, limit);
  }, [auditLog]);

  const createCompany = useCallback((name: string) => {
    const id = `company-${Date.now()}`;
    setCompanies((prev) => [...safeArray(prev), { id, name }]);
    setSelectedCompanyId(id);
  }, [setCompanies, setSelectedCompanyId]);

  const updateCompany = useCallback((id: string, name: string) => {
    setCompanies((prev) => safeArray(prev).map((company) =>
      company.id === id ? { ...company, name } : company
    ));
  }, [setCompanies]);

  const deleteCompany = useCallback((id: string) => {
    setCompanies((prev) => safeArray(prev).filter((company) => company.id !== id));
    if (selectedCompanyId === id) setSelectedCompanyId('default');
  }, [selectedCompanyId, setCompanies, setSelectedCompanyId]);

  const forceSync = useCallback(async () => {
    if (window.electronAPI?.saveBusinessSettings) {
      await window.electronAPI.saveBusinessSettings(settings);
    }
  }, [settings]);

  // ✅ MEMO VALUE (important for performance)
  const value = useMemo(
    () => ({
      clients: safeArray(clients),
      quotations: safeArray(quotations),
      invoices: safeArray(invoices),
      purchaseInvoices: safeArray(purchaseInvoices),
      payments: safeArray(payments),
      projects: recalculateProjects(safeArray(projects), safeArray(invoices)).map(p => ({
        ...p,
        totalPaymentReceived: safeArray(payments)
          .filter(pay => p.linkedInvoiceIds?.includes(pay.invoiceId))
          .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0)
      })),
      items: safeArray(items),
      salesmen: safeArray(salesmen),
      accounts: safeArray(accounts).length ? safeArray(accounts) : DEFAULT_ACCOUNTS,
      vouchers: safeArray(vouchers),
      journalEntries: safeArray(journalEntries),
      accountBalances,
      settings,
      companies: safeArray(companies).length ? safeArray(companies) : defaultCompanies,
      selectedCompanyId,
      isElectron,

      setClients,
      setQuotations,
      setInvoices,
      setPurchaseInvoices,
      setPayments,
      setProjects,
      setSettings,
      setSelectedCompanyId,

      addClient,
      updateClient,
      deleteClient,
      getClient,
      getCustomers,
      getVendors,

      addQuotation,
      updateQuotation,
      deleteQuotation,
      generateQuotationNumber,

      addInvoice,
      updateInvoice,
      deleteInvoice,
      generateInvoiceNumber,
      calculateInvoicePaymentStatus,

      addProject,
      updateProject,
      deleteProject,
      getProject,

      addPurchaseInvoice,
      updatePurchaseInvoice,
      deletePurchaseInvoice,
      generatePurchaseInvoiceNumber,

      addPayment,

      addItem,
      updateItem,
      deleteItem,
      adjustItemStock,

      addSalesman,
      getSalesman,

      addAccount,
      deleteAccount,
      getAccountBalance,

      addVoucher,
      addJournalVoucher,
      generateVoucherNumber,
      postTransactionEntry,
      createJournalEntry,
      postSalesInvoice,
      repostSalesInvoice,

      createCompany,
      updateCompany,
      deleteCompany,
      forceSync,

      getRecentAuditLog,
    }),
    [
      clients,
      quotations,
      invoices,
      purchaseInvoices,
      payments,
      projects,
      items,
      salesmen,
      accounts,
      vouchers,
      journalEntries,
      accountBalances,
      settings,
      companies,
      selectedCompanyId,
      isElectron,
      addClient,
      updateClient,
      deleteClient,
      getClient,
      getVendors,
      addQuotation,
      updateQuotation,
      deleteQuotation,
      generateQuotationNumber,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      generateInvoiceNumber,
      calculateInvoicePaymentStatus,
      addProject,
      updateProject,
      deleteProject,
      getProject,
      addPurchaseInvoice,
      updatePurchaseInvoice,
      deletePurchaseInvoice,
      generatePurchaseInvoiceNumber,
      addPayment,
      addItem,
      updateItem,
      deleteItem,
      adjustItemStock,
      addSalesman,
      getSalesman,
      addAccount,
      deleteAccount,
      getAccountBalance,
      addVoucher,
      addJournalVoucher,
      generateVoucherNumber,
      postTransactionEntry,
      createJournalEntry,
      postSalesInvoice,
      repostSalesInvoice,
      createCompany,
      updateCompany,
      deleteCompany,
      forceSync,
      getCustomers,
      getRecentAuditLog,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ✅ THIS IS THE IMPORTANT PART (fixes your error)
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
};
