const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),

  // Parties
  getParties: () => ipcRenderer.invoke('get-parties'),

  // Invoices
  saveInvoice: (invoice) => ipcRenderer.invoke('save-invoice', invoice),
  getInvoices: () => ipcRenderer.invoke('get-invoices'),

  // Quotations
  saveQuotation: (quotation) => ipcRenderer.invoke('save-quotation', quotation),
  getQuotations: () => ipcRenderer.invoke('get-quotations'),

  // Purchase Invoices
  savePurchaseInvoice: (purchaseInvoice) => ipcRenderer.invoke('save-purchase-invoice', purchaseInvoice),
  getPurchaseInvoices: () => ipcRenderer.invoke('get-purchase-invoices'),

  // Payments
  savePayment: (payment) => ipcRenderer.invoke('save-payment', payment),
  getPayments: () => ipcRenderer.invoke('get-payments'),

  // Accounts
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  saveAccount: (account) => ipcRenderer.invoke('save-account', account),

  // Business Settings
  getBusinessSettings: () => ipcRenderer.invoke('get-business-settings'),
  saveBusinessSettings: (settings) => ipcRenderer.invoke('save-business-settings', settings),

  // Dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Database info
  getDbPath: () => ipcRenderer.invoke('get-db-path'),

  // Backup/Restore
  backup: (destinationPath) => ipcRenderer.invoke('backup-db', destinationPath),
  restore: (backupPath) => ipcRenderer.invoke('restore-db', backupPath)
});