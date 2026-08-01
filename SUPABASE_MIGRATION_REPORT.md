# Final Pre-Production Cleanup + Supabase Migration — Report

This report covers the three phases requested: removing demo/mock data,
building empty-state experiences, and migrating to Supabase. Phases 1 and 2
are complete and live. Phase 3 is complete through the schema/RLS/RPC/client
layer — the honest stopping point before real `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` credentials exist to build and verify the
DataContext/AuthContext rewrite against. See "What's deliberately not done
yet" below for why that boundary was chosen instead of a blind rewrite.

## Phase 1 — Mock/demo data removed from production

`src/mocks/` (products, patients, doctors, vendors, labs, purchase orders,
sales, loans, users, batches, dashboard-adjacent seed data) still exists and
still powers local development and all 109 tests — but it is now gated
behind `import.meta.env.PROD`, which is only `true` for `vite build` (what
Vercel actually deploys). A production build starts every workspace
genuinely empty: no seeded users, patients, products, POs, sales, loans, or
clinic settings. `npm run dev` and `vitest run` are unaffected.

Key change: `src/store/DataContext.tsx` now initializes all 13 collections
from a `SEED` object that resolves to empty arrays in production and to the
existing mock data everywhere else. A new `src/store/currentActor.ts` module
also fixes a real bug found along the way — every movement/PO/loan/case
event and sale was being attributed to a hardcoded mock user regardless of
who was actually signed in; it's now attributed via `AuthContext` syncing
the real current member into that module.

## Phase 2 — Empty state experience

Every list page's empty state was rewritten in `src/content/helpText.ts` to
lead with "this is genuinely empty" framing (icon, explanation, primary CTA)
rather than assuming a filter was active — covers products, inventory,
purchase orders, vendors, patients, cases, labs, sales, loans, loan returns,
batches. The Users page had no empty state at all before this work; it now
has one (`src/pages/users/UsersPage.tsx`). Dashboard and Reports were
audited and already degrade gracefully per-section with real empty copy, so
they were left as-is.

## Phase 3 — Supabase migration

### 1. Files changed/added this session

```
supabase/migrations/0007_labs_and_loans.sql
supabase/migrations/0008_sales.sql
supabase/migrations/0009_workspace_settings_and_activity.sql
supabase/migrations/0010_row_level_security.sql
supabase/migrations/0011_rpc_functions.sql
src/lib/supabase/client.ts
src/lib/supabase/database.types.ts
src/vite-env.d.ts        (typed VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
.env.example
```

These extend a schema scaffold (`0001`–`0006`, plus the `@supabase/supabase-js`
dependency) that already existed in `main`'s history before this session —
`workspaces`, `workspace_members`, `workspace_invitations`, `manufacturers`,
`vendors`, `products`, `product_batches`, `inventory_movements`, `doctors`,
`patients`, `cases`, `purchase_orders` and their lines/events.

### 2. SQL migrations added this session

- **`0007_labs_and_loans.sql`** — `labs`, `loans`, `loan_lines`, `loan_events`;
  completes the deferred `cases.lab_id` / `inventory_movements.lab_id`
  foreign keys now that `labs` exists.
- **`0008_sales.sql`** — `sales`, `sale_lines`.
- **`0009_workspace_settings_and_activity.sql`** — `clinic_settings`,
  `security_prefs` (both 1:1 with a workspace), `audit_log` (account/security
  trail), `notifications`.
- **`0010_row_level_security.sql`** — RLS policies for every table (below).
- **`0011_rpc_functions.sql`** — the atomic write path for anything that
  touches `products.quantity_on_hand`: `create_workspace`,
  `complete_onboarding`, `accept_invitation`, `adjust_stock`,
  `receive_purchase_order`, `create_sale`, `add_implant_to_case`,
  `create_loan`, `return_loan_lines`. Every one is `SECURITY DEFINER` with a
  pinned `search_path` and independently re-checks the caller's workspace
  membership before writing anything.

Every business table carries `workspace_id uuid references workspaces(id)`;
ids are client-generatable UUIDs (`gen_random_uuid()`), which is what makes
optimistic updates possible without a server round-trip. Append-only tables
(`inventory_movements`, `purchase_order_events`, `case_events`,
`loan_events`) have update/delete revoked at the RLS layer, not just by
convention.

Apply in numeric order via `supabase db push` / `supabase migration up`, or
paste each file into the SQL Editor in order (0001 → 0011).

### 3. RLS policies

Enforced everywhere, no exceptions: **a workspace can never read or write
another workspace's data.** Every workspace-scoped table's policies check
`workspace_id in (select auth_workspace_ids())`; join tables without their
own `workspace_id` (`vendor_manufacturers`) are scoped through their parent.

Beyond that hard boundary, `0010` also enforces exactly what the original
`AuthContext` enforced client-side (workspace/team/security management
restricted to `is_workspace_manager()` — `owner`/`super_admin`/`admin`). It
deliberately does **not** re-implement the fine-grained `business_role`
permission matrix (View pricing / Adjust stock / etc., shown on the Users
page) at the database layer — that was always UI-only in the original app
too, and staying consistent with that beats inventing a new, stricter
boundary the app was never designed around. This reasoning is documented in
`0010`'s own header comment for future review.

`workspaces` and `workspace_invitations` have no direct client INSERT path —
row creation goes through the `create_workspace()` / `accept_invitation()`
RPCs, which are `SECURITY DEFINER` and validate membership/invite-token
possession themselves before writing.

### 4. Environment variables

| Variable | Used by | Required for |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase/client.ts` | Client to reach the project |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase/client.ts` | Client auth (RLS-scoped, safe to expose) |

Copy `.env.example` to `.env.local` and fill both in (Vite loads
`.env.local` automatically; it's already covered by the `*.local` gitignore
rule). Until both are set, `isSupabaseConfigured` is `false` and
`supabase` is `null` — nothing currently imports it, so the app keeps
running entirely on localStorage, unaffected.

A `SUPABASE_SERVICE_ROLE_KEY` will be needed later, server-side only (never
`VITE_`-prefixed / never shipped to the browser), for any admin script that
must bypass RLS — e.g. a one-off data-migration importer.

### 5. Remaining manual steps

1. Create the Supabase project, then run `supabase db push` (or paste
   `0001`–`0011` into the SQL Editor in order) against it.
2. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` and in
   Vercel's project environment variables.
3. In Supabase Auth settings: enable email/password, configure the
   Forgot-Password and email-verification templates/redirect URLs.
4. Create a Storage bucket for clinic logos and PO photos (referenced as
   `logo_url` / `photo_url` object paths in the schema, not base64 blobs).
5. Rewrite `DataContext.tsx` / `AuthContext.tsx` to read/write through
   `src/lib/supabase/client.ts` instead of local state + localStorage,
   introducing loading/error states and optimistic updates per mutation.
   **Not attempted this session** — see below.
6. Build the one-time localStorage → Supabase import flow, guarded by
   `workspaces.local_migration_completed_at` (column already exists) to
   prevent duplicate imports.
7. Design and wire up the biometric auth architecture (Face ID / Touch ID /
   Android Biometrics / Windows Hello via WebAuthn platform authenticators)
   as a device-level unlock layered on top of a Supabase Auth session — the
   existing PIN/WebAuthn scaffold in `accountTypes.ts` already anticipates
   this; it stays 100% client-side per `0002`'s own comment.
8. `supabase gen types typescript --project-id <id>` once a live project
   exists, to replace the hand-written `src/lib/supabase/database.types.ts`
   with a generated one (kept to the same `Database['public']['Tables'/...]`
   shape deliberately, so nothing importing it has to change).

### What's deliberately not done yet

The actual rewrite of `DataContext`/`AuthContext` to call Supabase, and the
data-migration UI, were not attempted blind. That rewrite touches nearly
every page, needs loading/error/optimistic-update handling introduced
throughout, and — critically — cannot be verified without a live database
to run it against. Shipping an unverifiable rewrite would leave the app
worse off than the fully-functional localStorage version it has today. This
is the stopping point matching the original instruction: continue
autonomously until Supabase credentials are genuinely required, which is
exactly the point the next step (#5 above) reaches.

## Verification checklist

- [x] `npx tsc --noEmit` — clean
- [x] `npm run lint` — 0 errors (8 pre-existing fast-refresh warnings, unrelated)
- [x] `npx vitest run` — 109/109 tests passing
- [x] `npm run build` — production build succeeds
- [x] Verified live in a production build (Playwright): first launch shows a
      genuinely empty workspace; Products, Users, and other list pages show
      the new polished empty states with working CTAs
- [x] `npm run dev` / `vitest` unaffected — seed data still present locally
- [x] All 11 SQL migration files reviewed for consistency (enum usage,
      workspace scoping, deferred-FK completion, RLS coverage) — not yet
      run against a live Postgres instance (no credentials available this
      session)
- [ ] Migrations applied to a real Supabase project (`supabase db push`)
- [ ] RLS policies verified against a live project (cross-workspace access
      actually denied, not just reviewed)
- [ ] `DataContext`/`AuthContext` rewritten to use Supabase (next phase)
- [ ] Data migration flow built and tested
- [ ] Biometric auth wired to real platform APIs
