## Goal
Wire the existing accounting app to the new Lovable Cloud database, behind authentication, while preserving all current features and existing local data.

## Step 1 — Authentication
- Add `src/pages/Auth.tsx`: email/password sign-up + sign-in tabs, plus Google sign-in button.
- Configure auth: auto-confirm email = ON (so users can sign in immediately during testing without an email server), Google provider enabled via `configure_social_auth`.
- Add `<AuthGuard>` in `src/components/AuthGuard.tsx` that:
  - subscribes via `supabase.auth.onAuthStateChange` first, then calls `getSession()`
  - while loading → spinner; if no session → redirect to `/auth`
- Wrap all routes in `App.tsx` with `AuthGuard` except `/auth`.
- Add a "Sign out" button in `Settings.tsx` (and/or the FAB radial menu).

## Step 2 — Data layer (`src/contexts/AppContext.tsx`)
Refactor from `useLocalStorage` to Supabase-backed state:

- On mount (when session exists): fetch all 12 collections in parallel with `supabase.from(table).select('*')`, map snake_case → camelCase, hydrate state.
- Each `add* / update* / delete*` method becomes async: optimistic local update + `supabase.from(table).insert/update/delete()`, rollback on error and toast.
- Keep the existing public API of `AppContext` (same method names/signatures, `await`-able) so pages don't need rewrites. Pages that don't await still work because they read from the optimistically-updated local state.
- `user_id` is set automatically by table DEFAULT `auth.uid()`, so inserts only need business fields + `id` (text PK we already generate via `uuid.ts`).
- Active company persists in localStorage (UI preference); company list comes from DB.

## Step 3 — One-time migration of existing localStorage data
- On first login, detect legacy `MITC:*` localStorage keys.
- Show a one-click "Import existing local data to your account" banner on the Dashboard.
- On confirm: bulk-insert each collection into Supabase (idempotent via existing `id` text PKs), then clear the legacy keys.

## Step 4 — Cleanup
- Remove `useRemoteCollection` / `apiClient` references that point at the old custom server (no longer needed; Supabase replaces it).
- Keep `useLocalStorage` only for pure UI preferences (theme, active company id, sidebar state).

## Technical notes
- All tables already have RLS scoped to `auth.uid() = user_id` and `user_id DEFAULT auth.uid()`. Inserts will Just Work once the user is signed in.
- JSONB columns (`items`, `activities`, `project_summary`, `lines`, `details`, `linked_invoice_ids`) map directly to the existing TS objects — no schema changes needed.
- Field name mapping (snake_case ↔ camelCase) handled by a small `mappers.ts` per entity, kept in `src/lib/supabaseMappers.ts`.

## Out of scope (for this pass)
- Multi-user collaboration / sharing (RLS is strictly per-user for now).
- Realtime subscriptions (can be added later by enabling `supabase_realtime` per table).
- Server-side voucher numbering (still computed client-side from local state, which is now hydrated from DB).

## Deliverable
After this change: users sign in → their data loads from the cloud → every create/edit/delete writes through to Supabase → data syncs across devices. Existing UI/UX unchanged.
