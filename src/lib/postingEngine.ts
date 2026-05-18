import type { Invoice, JournalEntry, JournalLine } from '@/types';

const SALES_INVOICE_REFERENCE_TYPE = 'sales_invoice' as const;

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const getInvoicePostingVersion = (invoice: Invoice): string => {
  const maybeVersion = (invoice as Invoice & { _version?: number })._version;
  if (typeof maybeVersion === 'number' && Number.isFinite(maybeVersion)) {
    return String(maybeVersion);
  }
  return invoice.updatedAt || invoice.createdAt;
};

export const buildSalesInvoiceJournalLines = (invoice: Invoice): JournalLine[] => {
  const invoiceTotal = toNumber(invoice.netTotal);
  const vatTotal = invoice.items.reduce((sum, item) => sum + toNumber(item.vatAmount), 0);
  const revenue = Math.max(0, invoiceTotal - vatTotal);

  return [
    { accountId: 'acc-1100', debit: invoiceTotal, credit: 0 },
    { accountId: 'acc-4000', debit: 0, credit: revenue },
    ...(vatTotal > 0 ? [{ accountId: 'acc-2000', debit: 0, credit: vatTotal }] : []),
  ];
};

export const reverseJournalLines = (lines: JournalLine[]): JournalLine[] =>
  lines.map((line) => ({
    ...line,
    debit: toNumber(line.credit),
    credit: toNumber(line.debit),
  }));

export const buildSalesInvoicePostingEntry = (invoice: Invoice): JournalEntry => {
  const now = new Date().toISOString();
  const version = getInvoicePostingVersion(invoice);

  return {
    id: crypto.randomUUID(),
    date: now,
    reference: invoice.number,
    referenceType: SALES_INVOICE_REFERENCE_TYPE,
    referenceId: invoice.id,
    description: `Sales Invoice ${invoice.number}`,
    lines: buildSalesInvoiceJournalLines(invoice),
    createdAt: now,
    idempotencyKey: `${SALES_INVOICE_REFERENCE_TYPE}:${invoice.id}:${version}`,
  };
};

export const buildSalesInvoiceReversalEntry = (
  invoice: Invoice,
  sourceEntry: JournalEntry,
  reason = 'Reversal before repost'
): JournalEntry => {
  const now = new Date().toISOString();
  const version = getInvoicePostingVersion(invoice);

  return {
    id: crypto.randomUUID(),
    date: now,
    reference: `${invoice.number}-REV`,
    referenceType: SALES_INVOICE_REFERENCE_TYPE,
    referenceId: invoice.id,
    description: `${reason} (${invoice.number})`,
    lines: reverseJournalLines(sourceEntry.lines),
    createdAt: now,
    idempotencyKey: `${SALES_INVOICE_REFERENCE_TYPE}:${invoice.id}:${version}:reversal:${sourceEntry.id}`,
    reversalOf: sourceEntry.id,
  };
};

export const repostSalesInvoice = (
  invoiceBefore: Invoice,
  invoiceAfter: Invoice,
  existingEntries: JournalEntry[]
): JournalEntry[] => {
  if (invoiceBefore.id !== invoiceAfter.id) {
    throw new Error('Cannot repost across different invoice references');
  }
  const reversalEntries = existingEntries.map((entry) =>
    buildSalesInvoiceReversalEntry(invoiceAfter, entry)
  );
  return [...reversalEntries, buildSalesInvoicePostingEntry(invoiceAfter)];
};
