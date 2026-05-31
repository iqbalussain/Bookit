/// <reference types="vite/client" />

interface ElectronAPI {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  getParties: () => Promise<unknown[]>;
  saveInvoice: (invoice: unknown) => Promise<{ id: string }>;
  getInvoices: () => Promise<unknown[]>;
  saveQuotation: (quotation: unknown) => Promise<{ id: string }>;
  getQuotations: () => Promise<unknown[]>;
  savePurchaseInvoice: (purchaseInvoice: unknown) => Promise<{ id: string }>;
  getPurchaseInvoices: () => Promise<unknown[]>;
  savePayment: (payment: unknown) => Promise<{ id: string }>;
  getPayments: () => Promise<unknown[]>;
  getAccounts: () => Promise<any[]>;
  saveAccount: (account: any) => Promise<{ id: string }>;
  getBusinessSettings: () => Promise<any>;
  saveBusinessSettings: (settings: any) => Promise<void>;
  showSaveDialog: (options: any) => Promise<any>;
  showOpenDialog: (options: any) => Promise<any>;
  getDbPath: () => Promise<string>;
  backup: (destinationPath: string) => Promise<void>;
  restore: (backupPath: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron?: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on?: (channel: string, listener: (...args: any[]) => void) => void;
        send?: (channel: string, ...args: any[]) => void;
      };
    };
  }
}
