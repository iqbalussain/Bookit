# Fix Edit/Delete on Invoices, Payments, Vouchers + Sequence Sales List

## What changes

### 1. Sales invoice list sorted by invoice number (sequence)
`src/pages/InvoicesList.tsx` currently sorts by `updatedAt` desc.
Change to sort by `invoice.number` in descending natural order (newest sequence number first), using a `localeCompare(..., undefined, { numeric: true })` comparator so `INV-2026-010` comes after `INV-2026-009`.

### 2. Allow editing invoices marked as Sent / Partial / Overdue
In `src/pages/InvoiceForm.tsx`:
- The form already loads the data; only the **Save Changes** button is hidden because of `currentStatus === 'draft'`.
- Show **Save Changes** for any status except `cancelled` (so draft, sent, partial, overdue, paid can all be edited).
- Keep the existing `repostSalesInvoice` flow on save — journals are reversed and reposted automatically.
- Inputs are already editable; no other gating exists.

### 3. Delete + Edit for Payment & Receipt vouchers
- Add `updatePayment(payment)` and `deletePayment(id)` to `src/contexts/AppContext.tsx`. Delete also reverses the associated journal entry via `reverseJournalForReference('receipt'|'payment', paymentId)` and recomputes the parent invoice status; update re-posts the journal.
- Rework `src/pages/PaymentsReceipts.tsx`:
  - Keep the existing "create" form at the top.
  - Add a **History list** below showing all payments + receipts (filterable by tab) with: invoice number, party, amount, date, method, plus **Edit** and **Delete** buttons.
  - Edit loads the record back into the form (form switches to "update" mode and on save calls `updatePayment` instead of `addPayment`).
  - Delete calls `deletePayment` and refreshes the parent invoice's status.

### 4. Delete + Edit for other Vouchers (Expense / Contra / Loan / Journal)
- Add `updateVoucher(voucher)` and `deleteVoucher(id)` to `AppContext.tsx`. Delete reverses the linked journal entry (by `referenceId = voucher.id`); update reverses and re-posts.
- In `src/pages/VoucherDashboard.tsx`, change the **Recent Vouchers** list rows to include **Edit** (navigates to `/vouchers/{type}/{id}`) and **Delete** (confirm + call `deleteVoucher` / `deletePayment`).
- The existing voucher form pages (`ExpensesVoucher`, `ContraVoucher`, `LoanGivenVoucher`, `LoanReceivedVoucher`, `JournalVoucher`) already accept an `id` param pattern via routes; wire the routes in `App.tsx` to `/vouchers/{type}/:id` and prefill the form when an id is present. Save in edit mode calls `updateVoucher` + repost.

### 5. Clean up "issues in the application"
Scope the cleanup to small, observable problems:
- Remove the now-unused `import { Badge }` etc. that would become dead after the edits.
- Ensure `calculateInvoicePaymentStatus` is recomputed after a payment is deleted (currently it is derived from `payments[]` so this is automatic — no change needed beyond removing the payment row).
- No schema migration required; all tables already have full RLS for insert/update/delete.

## Technical notes

- Journal reversal pattern already exists for `sales_invoice`. Extend `reverseJournalForReference` in `AppContext` to handle `'receipt' | 'payment' | 'expense' | 'contra' | 'loan_given' | 'loan_received' | 'journal'` by emitting a reversal entry (debits/credits flipped) with `reversalOf = original.id` and a new idempotency key.
- All new context methods follow the existing `addAuditEntry` convention.
- Sort comparator example:
  ```ts
  filteredInvoices.sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }))
  ```

## Out of scope
- No design overhaul of the voucher dashboard or payments page.
- No multi-user permission changes.
- No new reports.
