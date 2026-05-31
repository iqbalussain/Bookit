// Party types
export type PartyType = 'customer' | 'vendor' | 'both';

// Client types
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  type: PartyType;
  paymentTermsDays?: number;
  taxRegistrationNumber?: string;
  creditLimit?: number;
  createdAt: string;
}

// Line item for quotations/invoices
export interface LineItem {
  id: string;
  itemId?: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  total: number;
  cost?: number;
  stock?: number;
  reorderLevel?: number;
  vatApplicable?: boolean;
  vatPercentage?: number;
  vatAmount?: number;
}

// Item master
export interface Item {
  id: string;
  name: string;
  description?: string;
  unit?: string;
  rate: number;
  cost?: number;
  stock: number;
  reorderLevel?: number;
  vatApplicable: boolean;
  vatPercentage: number;
  createdAt: string;
}

// Quotation types
export type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'converted';

export interface Quotation {
  id: string;
  number: string;
  clientId: string;
  salesmanId?: string;
  items: LineItem[];
  netTotal: number;
  status: QuotationStatus;
  convertedInvoiceId?: string;
  notes: string;
  terms: string;
  createdAt: string;
  updatedAt: string;
}

// Invoice types
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  salesmanId?: string;
  quotationId?: string;
  items: LineItem[];
  netTotal: number;
  status: InvoiceStatus;
  dueDate: string;
  notes: string;
  terms: string;
  createdAt: string;
  updatedAt: string;
}

// Purchase Invoice types
export type PurchaseInvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue';

export interface PurchaseInvoice {
  id: string;
  number: string;
  vendorId: string;
  items: LineItem[];
  netTotal: number;
  status: PurchaseInvoiceStatus;
  dueDate: string;
  notes: string;
  terms: string;
  createdAt: string;
  updatedAt: string;
}

// Payment types
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'cheque' | 'online';

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceType: 'sales' | 'purchase';
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  notes: string;
  createdAt: string;
}

// Double-Entry Accounting types
export type AccountType = 'asset' | 'liability' | 'income' | 'expense' | 'equity';
export type AccountNodeKind = 'group' | 'ledger';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  kind: AccountNodeKind;
  parentId: string | null;
  isSystem: boolean;
}

// Voucher types
export type VoucherType = 'contra' | 'expense' | 'loan_given' | 'loan_received' | 'journal';

export interface Voucher {
  id: string;
  number: string;
  type: VoucherType;
  date: string;
  partyName: string;
  amount: number;
  narration: string;
  method: string;
  reference?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  referenceType: 'sales_invoice' | 'purchase_invoice' | 'receipt' | 'payment' | 'contra' | 'expense' | 'loan_given' | 'loan_received' | 'journal';
  referenceId: string;
  description: string;
  lines: JournalLine[];
  createdAt: string;
  idempotencyKey?: string;
  reversalOf?: string;
}

export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface AuditEntry {
  id: string;
  type: 'client' | 'quotation' | 'invoice' | 'purchase_invoice' | 'payment' | 'voucher' | 'account' | 'settings';
  action: 'created' | 'updated' | 'deleted' | 'processed' | 'saved' | 'approved' | 'paid';
  target: string;
  value?: number;
  details?: string;
  createdAt: string;
}

// Default Chart of Accounts
export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'grp-asset-root', code: '1000', name: 'Assets', type: 'asset', kind: 'group', parentId: null, isSystem: true },
  { id: 'grp-liability-root', code: '2000', name: 'Liabilities', type: 'liability', kind: 'group', parentId: null, isSystem: true },
  { id: 'grp-equity-root', code: '3000', name: 'Equity', type: 'equity', kind: 'group', parentId: null, isSystem: true },
  { id: 'grp-income-root', code: '4000', name: 'Income', type: 'income', kind: 'group', parentId: null, isSystem: true },
  { id: 'grp-expense-root', code: '5000', name: 'Expenses', type: 'expense', kind: 'group', parentId: null, isSystem: true },

  { id: 'grp-cash-bank', code: '1010', name: 'Cash/Bank', type: 'asset', kind: 'group', parentId: 'grp-asset-root', isSystem: true },
  { id: 'acc-1000', code: '1001', name: 'Cash', type: 'asset', kind: 'ledger', parentId: 'grp-cash-bank', isSystem: true },
  { id: 'acc-1010', code: '1011', name: 'Bank', type: 'asset', kind: 'ledger', parentId: 'grp-cash-bank', isSystem: true },

  { id: 'grp-sundry-debtors', code: '1100', name: 'Sundry Debtors', type: 'asset', kind: 'group', parentId: 'grp-asset-root', isSystem: true },
  { id: 'acc-1100', code: '1101', name: 'Accounts Receivable', type: 'asset', kind: 'ledger', parentId: 'grp-sundry-debtors', isSystem: true },
  { id: 'acc-1200', code: '1200', name: 'Loans & Advances', type: 'asset', kind: 'ledger', parentId: 'grp-asset-root', isSystem: true },

  { id: 'grp-sundry-creditors', code: '2100', name: 'Sundry Creditors', type: 'liability', kind: 'group', parentId: 'grp-liability-root', isSystem: true },
  { id: 'acc-2000', code: '2101', name: 'Accounts Payable', type: 'liability', kind: 'ledger', parentId: 'grp-sundry-creditors', isSystem: true },
  { id: 'acc-2100', code: '2110', name: 'Loans Payable', type: 'liability', kind: 'ledger', parentId: 'grp-liability-root', isSystem: true },

  { id: 'acc-3000', code: '3001', name: "Owner's Equity", type: 'equity', kind: 'ledger', parentId: 'grp-equity-root', isSystem: true },
  { id: 'acc-3100', code: '3102', name: 'Retained Earnings', type: 'equity', kind: 'ledger', parentId: 'grp-equity-root', isSystem: true },
  { id: 'acc-4000', code: '4001', name: 'Sales Revenue', type: 'income', kind: 'ledger', parentId: 'grp-income-root', isSystem: true },
  { id: 'acc-5000', code: '5001', name: 'General Expenses', type: 'expense', kind: 'ledger', parentId: 'grp-expense-root', isSystem: true },
  { id: 'acc-5100', code: '5102', name: 'Cost of Goods', type: 'expense', kind: 'ledger', parentId: 'grp-expense-root', isSystem: true },
];

// Company definitions
export interface Company {
  id: string;
  name: string;
}

// Salesman
export interface Salesman {
  id: string;
  name: string;
  phone?: string;
  createdAt: string;
}

// Business settings
export interface BusinessSettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  logo?: string;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'OMR';
  taxNumber?: string;
  theme?: 'light' | 'dark' | 'system';
  vatEnabled?: boolean;
  defaultVatPercentage?: number;
  bankName?: string;
  bankAccountNumber?: string;
  signature?: string; // Base64 encoded signature image
}

// Currency symbols
export const currencySymbols: Record<BusinessSettings['currency'], string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  OMR: 'ر.ع.',
};

// Electron API types
export interface ElectronAPI {
  // Database operations
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  getParties: () => Promise<unknown[]>;
  saveInvoice: (invoice: unknown) => Promise<unknown>;
  getInvoices: () => Promise<unknown[]>;
  saveQuotation: (quotation: unknown) => Promise<unknown>;
  getQuotations: () => Promise<unknown[]>;
  savePurchaseInvoice: (purchaseInvoice: unknown) => Promise<unknown>;
  getPurchaseInvoices: () => Promise<unknown[]>;
  savePayment: (payment: unknown) => Promise<unknown>;
  getPayments: () => Promise<unknown[]>;
  getAccounts: () => Promise<unknown[]>;
  saveAccount: (account: unknown) => Promise<unknown>;
  getBusinessSettings: () => Promise<unknown>;
  saveBusinessSettings: (settings: unknown) => Promise<void>;
  showSaveDialog: (options: unknown) => Promise<unknown>;
  showOpenDialog: (options: unknown) => Promise<unknown>;
  getDbPath: () => Promise<string>;
  backup: (destinationPath: string) => Promise<void>;
  restore: (backupPath: string) => Promise<void>;

  // Update methods
  update: {
    checkForUpdates: () => Promise<any>;
    downloadUpdate: () => Promise<any>;
    installUpdate: () => Promise<any>;
    getVersion: () => Promise<string>;
    onUpdateAvailable: (callback: (info: any) => void) => void;
    onUpdateProgress: (callback: (percent: number) => void) => void;
    onUpdateReady: (callback: () => void) => void;
    onUpdateError: (callback: (error: string) => void) => void;
  };
}

// Extend Window interface
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
