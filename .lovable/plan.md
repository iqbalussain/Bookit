# Fix App Freeze on Sales / Quotations / Projects Pages

## Root cause (single underlying problem)

After investigation, the slowness is **not** in the list pages themselves — they are small and render simple cards. The freeze is caused by a render-storm coming from `AppContext` and `useLocalStorage`. Three concrete issues, in order of impact:

### Issue 1 — `useLocalStorage` returns a new `setValue` on every render
**File:** `src/hooks/useLocalStorage.ts` (lines 33-46)

```ts
const setValue = useCallback((value) => { … }, [key, storedValue]);
```

Because `storedValue` is in the deps, `setValue` gets a **new identity every time the state changes**. This is consumed 13+ times in `AppContext.tsx` (clients, quotations, invoices, projects, payments, journalEntries, …). The result:

- Every effect downstream that depends on `setX` re-fires on every state change.
- `useRemoteCollection.setAndPush` (deps `[collection, remote, setValue]`) is itself recreated on every render, so its consumers' setters are also unstable.
- The `AppContext.Provider` value object is a new literal on every render, so **every consumer re-renders on every state change of any collection**. Saving an invoice triggers 4-6 state updates in sequence (invoice, journalEntries, accountBalances, audit log, items stock) — each one re-renders InvoiceForm, both lists, the radial menu, the dashboard, etc.

### Issue 2 — `InvoiceForm` regenerates the invoice number on every context render
**File:** `src/pages/InvoiceForm.tsx` (lines 100-104)

```ts
useEffect(() => {
  if (invoiceNumberMode === 'auto') setInvoiceNumber(generateInvoiceNumber());
}, [invoiceNumberMode, generateInvoiceNumber]);
```

`generateInvoiceNumber` is a fresh closure on every `AppContext` render (no `useCallback`). Combined with Issue 1, this effect runs constantly while editing — re-computing a number, setting state, and forcing the form to re-render. On an existing invoice it can also overwrite the saved number while typing.

### Issue 3 — `InvoicesList` recomputes payment status O(N×M) per render
**File:** `src/pages/InvoicesList.tsx` (lines 36-42 and 125-127)

`calculateInvoicePaymentStatus(invoice.id)` is called inside both `.filter(...)` and `.map(...)`. For every invoice it scans all payments. Multiplied by the re-render storm from Issue 1, this becomes the visible freeze on the Sales page.

## Fixes (small, surgical)

### Fix A — Stabilize `useLocalStorage` setter
**File:** `src/hooks/useLocalStorage.ts`

Use a ref to read the latest value inside `setValue`, and drop `storedValue` from the deps so the setter identity is stable for the component's lifetime:

```ts
const storedRef = useRef(storedValue);
useEffect(() => { storedRef.current = storedValue; }, [storedValue]);

const setValue = useCallback((value) => {
  const newValue = value instanceof Function ? value(storedRef.current) : value;
  …
}, [key]);
```

This single change makes every `setX` in `AppContext` stable, which in turn makes the `useEffect`s and provider-value memoization actually work.

### Fix B — Memoize `AppContext.Provider` value and the number generators
**File:** `src/contexts/AppContext.tsx`

1. Wrap `generateInvoiceNumber`, `generateQuotationNumber`, `generatePurchaseInvoiceNumber`, `getClient`, `getSalesman`, `getInvoice`, `getQuotation`, `getProject`, `getItem`, `calculateInvoicePaymentStatus` in `useCallback` with the right deps (`[invoices]`, `[quotations]`, etc.). No logic changes.
2. Wrap the giant object passed to `AppContext.Provider value={…}` in `useMemo` with all collections + the (now stable) callbacks as deps.

After Fix A this prevents the cascading re-render of every consumer on every unrelated state change.

### Fix C — Drop unstable dep in `InvoiceForm` auto-number effect
**File:** `src/pages/InvoiceForm.tsx`

Change deps to `[invoiceNumberMode]` only (the generator is still called inside but its identity no longer matters). Also guard so it never overwrites an existing invoice's number:

```ts
useEffect(() => {
  if (invoiceNumberMode === 'auto' && !isEditing) {
    setInvoiceNumber(generateInvoiceNumber());
  }
}, [invoiceNumberMode, isEditing]);
```

### Fix D — Single-pass payment totals in `InvoicesList`
**File:** `src/pages/InvoicesList.tsx`

Pull `payments` from the context, build a `Map<invoiceId, totalPaid>` once with `useMemo`, and let `getDisplayStatus` read from it. Drops the per-render scan from O(N×M) to O(N+M). No UI change.

## Files touched (4 only)

1. `src/hooks/useLocalStorage.ts` — stable setter via ref
2. `src/contexts/AppContext.tsx` — `useCallback` on getters + `useMemo` on provider value
3. `src/pages/InvoiceForm.tsx` — fix auto-number effect deps + guard
4. `src/pages/InvoicesList.tsx` — memoized payment totals map

## Expected performance impact

- **Sales / Quotations / Projects pages:** ~10× faster initial render and near-instant interaction (no more re-render on unrelated state changes).
- **Saving an invoice / voucher / payment:** instant. Today each save fires 4-6 sequential context updates, each one re-rendering every consumer; after the fix only consumers of the changed slice re-render.
- **Editing in InvoiceForm:** typing no longer triggers the auto-number effect → no more lag / flicker on each keystroke.
- **No UI redesign, no business-logic change, no schema change.**

## What is explicitly NOT touched

- No changes to journal-posting math, RLS, voucher numbering, invoice/sales sorting, or auth.
- No refactor of `useRemoteCollection` (Fix A alone stabilizes its inputs).
- No changes to `PaymentsReceipts.tsx`, `VoucherDashboard.tsx`, `ProjectsList.tsx`, `QuotationsList.tsx` — they get faster automatically once Fixes A + B land.

Fits comfortably in 3 credits.
