# HANDOFF.md — Start Here for a New Session

> **Purpose:** This document lets a brand-new Claude session pick up work on ImplaTrax with zero prior context. Read this file first, in full, before touching any code or answering the user. It tells you what exists, what's proven, what's next, and the exact rules of engagement this project runs under.

> **⚠️ This is a full rewrite (2026-08-04), not an edit of the prior version.** The previous `HANDOFF.md` described a client-only, no-backend prototype. That is no longer true — the app now runs on a real Supabase backend with real auth, and everything below reflects that. If anything here conflicts with `PROJECT.md` or `ARCHITECTURE.md`, **trust this file and the code, not those two** — see §9 for exactly how stale they are and why.

---

## 1. What this project is

ImplaTrax is a **Supabase-backed** React/TypeScript/Vite inventory and workflow platform for dental implant clinics and labs — purchasing, storage, loans to labs, patient cases, and sales, with full stock-movement traceability, multi-workspace support, device-level PIN/biometric auth, role-based access, an audit trail, document generation (invoices, challans, POs, case summaries), CSV import/export, reporting, and a self-contained PDF User Manual. It started as a client-only prototype ("ImplantDesk 1.8"), was rebranded to **ImplaTrax**, and has since been migrated wholesale onto Supabase (Postgres + Auth + Row-Level Security + RPC functions) — it is no longer a "clickable prototype with no backend," it is a real multi-tenant application with a real database.

Full product framing, business rules, and terminology **used to be** in `PROJECT.md` — that document is now significantly out of date (still says "no backend required," "client-only prototype"). Read it for historical business-rule context only, and verify anything load-bearing against the actual code before trusting it. Same caveat for `ARCHITECTURE.md`. See §9.

---

## 2. Current repo state (verify before trusting this — it's a snapshot)

- **Branch:** `claude/p1-f-doc-generation-scope-dtee4y`. **This is where all real work lives.**
- **⚠️ `main` is 48 commits behind this branch** (`git rev-list --count main..HEAD` as of this writing) — last merge to `main` was PR #2, which predates the entire rebrand, the entire Auth/device-PIN system, and the entire Supabase migration. **If you deploy from `main`, you get the old pre-Supabase client-only prototype, not this app.** Confirm with the user which branch their live deployment (`implatrax.vercel.app` was seen live during this session) actually tracks before assuming either way — don't guess, and don't merge to `main` without explicit permission (per standing instructions this session has followed throughout).
- **Latest commit:** `e3f2e53` — "Fix header title/subtitle clipping and jitter on Products (and every StickyActionHeader page)." Run `git log -1` yourself to confirm this is still current.
- **Remote:** `origin` → `https://github.com/chintan-hub/ImplaTrax.git`.
- **Working tree:** clean as of the last commit — verify with `git status`.
- **⚠️ Tooling gotcha, still true:** the root `tsconfig.json` uses project references with an empty root `files: []`. Plain `npx tsc --noEmit` silently checks **zero files** and always exits 0. **Always use `npx tsc -b --noEmit`.**
- **Verification status as of `e3f2e53`** (all four re-run and confirmed personally while writing this, not copied from an old commit message):
  - `npx tsc -b --noEmit` → clean.
  - `npx eslint .` → 0 errors, 8 pre-existing `react-refresh/only-export-components` warnings (not new, not worth chasing — see the files listed if curious: `ThemeProvider.tsx`, `badge.tsx`, `button.tsx`, `AuthContext.tsx`, `TourContext.tsx`, `SettingsHeaderActionContext.tsx` ×2, `DataContext.tsx`).
  - `npx vitest run` → **34/34 passing**, 7 test files.
  - `npm run build` → succeeds. One pre-existing warning (main JS chunk is ~3.4 MB / ~1 MB gzipped — no code-splitting yet; not an error, not new).
- **⚠️ Real, unaddressed regression in test coverage, discovered while writing this handoff:** the old `HANDOFF.md` reported **77 tests**. There are now **34**. `src/store/DataContext.test.tsx`, `src/features/auth/AuthContext.test.tsx`, and `src/features/auth/authPersistence.test.ts` **no longer exist** — they tested the old synchronous in-memory-mock mutation model, which the Supabase migration replaced with async network calls, and nothing was written to replace them. **The core business-logic mutation surface (`DataContext`'s Supabase-backed actions) and the entire auth/workspace flow (`AuthContext`) currently have zero automated test coverage.** What remains (`crypto.test.ts`, `useCurrencyFormat.test.tsx`, `batches.test.ts`, `caseWorkflow.test.ts`, `csv.test.ts`, `purchaseOrder.test.ts`, `utils.test.ts`) covers pure functions and a couple of hooks, not the actual data/auth layer. This is a real gap, not a stale-doc artifact — confirm it yourself with `find src -name "*.test.ts*"` before deciding whether/how to close it.
- **No `.env`/`.env.local` exists in a fresh sandbox checkout** — without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set, `isSupabaseConfigured` is `false` and the entire app is stuck on the onboarding screen forever (every real page requires an authenticated workspace). This blocked live browser verification for large parts of this session — see `.env.example` for the two required vars. If you need real credentials, ask the user; this session never had them for the actual Supabase project (only ever worked with what was already deployed/configured on Vercel, verified indirectly via user screenshots and bug reports).
- **Repo visibility:** unconfirmed as of this writing — the previous handoff said it had been made public mid-project to work around missing GitHub credentials in a computer-use sandbox. This session's environment had working `git`/GitHub access throughout (pushed every commit directly), so this may no longer be relevant — see §9's GitHub-access note only if a fresh sandbox session hits auth trouble.

---

## 3. Architecture (short version — `ARCHITECTURE.md` is stale, don't trust it for backend claims)

- **Stack:** React 19 + TypeScript 5.7 + Vite 6, Tailwind CSS 3 + Radix UI primitives (shadcn-pattern hand-built components in `src/components/ui/`), React Router v6, `@supabase/supabase-js` ^2.111, Vitest + `@testing-library/react`.
- **Real backend now: Supabase.** Postgres + Supabase Auth + Row-Level Security + RPC functions. Schema lives in `supabase/migrations/0001`–`0014` (extensions/enums → workspaces/members → reference data → products/inventory → purchase orders → doctors/patients/cases → labs/loans → sales → workspace settings/activity → RLS → RPC functions → photo attachments → void/lifecycle/wipe RPCs → an audit-log actor-name bugfix). Read the migrations in order if you need the real schema — don't infer it from `PROJECT.md`'s data-model section, which describes the old in-memory shape.
- **`src/lib/supabase/`** is the entire data-access layer: `client.ts` (the Supabase client singleton + `isSupabaseConfigured`), `database.types.ts` (generated types), `queries.ts` (every read/write, grouped by domain — mutations either call one of the transactional RPCs for multi-row/quantity-affecting writes, or a plain `.insert()`/`.update()` where RLS alone is sufficient), `mappers.ts` (snake_case DB rows ↔ app-shaped camelCase types), `demoSeed.ts` (populates a brand-new Demo Workspace with realistic sample data).
- **`src/store/DataContext.tsx`** is still the sole mutation surface for business entities (products, inventory movements, purchase orders, vendors, patients, cases, labs, sales, loans, doctors, clinic settings) — same convention as before, but every action is now `async` and hits Supabase via `queries.ts`, not a synchronous `setState`. `requireWorkspace()` guards every action that needs a workspace ID (`currentWorkspace?.id`), throwing a clear `BusinessRuleError` if none is loaded.
- **`src/features/auth/AuthContext.tsx`** is new since the last handoff and is now load-bearing for the entire app: Supabase Auth session, workspace creation/switching, member roles (`AccountRole` = `owner | super-admin | admin | manager | staff | read-only`, in `src/features/auth/accountTypes.ts` — **distinct from and unrelated to** any older "business permission" role concept `PROJECT.md` may still describe), device-level PIN pairing (`crypto.ts`, salted+hashed, stored per-device) with optional WebAuthn biometric unlock (`webauthn.ts`), password reset via Supabase Auth email flow (`/reset-password`, deliberately routed outside `DataProvider`/`AuthGate` since a bare recovery session has no workspace to hydrate — see `App.tsx`), a full audit log (`audit_log` table, one row per meaningful business/security action), and a one-click **Demo Workspace** (unauthenticated landing page only, pre-seeded via `demoSeed.ts`, auto-hidden from "Your Workspaces" once the same account also has a real workspace — see `WorkspaceTab.tsx`).
- **`AuthGate.tsx`** sits above the routed app: renders `OnboardingFlow` (no session), `LoginScreen` (session exists, device not unlocked), or the real app (unlocked). Every real route requires `DataProvider` (workspace data) nested inside `AuthGate` (auth state) — see `App.tsx` for the exact provider order, which matters (`DataProvider` outside `AuthGate`, not inside — this was itself a bugfix, commit `a2a13c2`).
- **Shared auth visual language**: `src/features/auth/authTheme.ts` centralizes every spacing/surface/motion constant used by `LoginScreen`, `OnboardingFlow`, and `ResetPasswordPage` so the three screens stay pixel-consistent — prefer editing constants there over per-screen overrides. All three use a non-scrolling `h-screen overflow-hidden` shell (fixed after being scroll-broken earlier this session).
- **Sticky header system (new this session, applies app-wide)**: `src/components/shared/StickyActionHeader.tsx` is the one sticky action header every major page renders — title/description/actions and an optional `toolbar` slot (search/filters, or a page's `TabsList`) all live in a *single* `position: sticky` block with a shrink-on-scroll transition, rather than independently-stuck elements that would need their offsets kept in sync. It exposes `group` + `data-scrolled` on its wrapper so nested content (e.g. `TabsList`/`TabsTrigger` in `components/ui/tabs.tsx`) can shrink in step via `group-data-[scrolled=true]:*` CSS variants — a real, working pattern now, not aspirational. Reports and Settings' tab bars were moved into this `toolbar` slot this session specifically to get this for free; mirror that for any future tabbed page rather than adding a second independent sticky element.
- **The rest of the pre-Supabase architecture notes are still accurate**: `DataContext` is still the sole mutation surface for the entities it owns; the throw-before-mutate `BusinessRuleError` convention still holds (now thrown before the Supabase call, not before `setState`); the guard-function modules (`poWorkflow.ts`, `caseWorkflow.ts`, `loanWorkflow.ts`) are unchanged; append-only history-on-the-entity is unchanged; the detail-page pattern, status-actions pattern, document-generation layer (`src/lib/documents/`), and deterministic ID generation are all unchanged in shape, just now backed by real inserts instead of mock array pushes.

---

## 4. Permanent, locked product/UX principles (do not relitigate these)

Full detail (mostly still accurate) in `PROJECT.md` §2/§2a — **except** anywhere it says "no backend required" or "prototype," which is now false. Summary:

1. **Desktop-app feel, not a website.** Minimize clicks/scrolling/cursor travel.
2. **Business workflows and usability outrank infrastructure work.**
3. **No wasted clicks** — sticky page header + toolbar + table header pattern is now real and shipped app-wide (see §3) — this used to be "not yet fully built," it now is.
4. **Standing permission to refactor previously-built UI for usability** whenever working in that area, as long as business logic and data integrity are unchanged.
5. **Two-tier workflow for UX issues found mid-development**: local/low-risk → fix immediately. Needs a consistent cross-app pattern → log it in `USABILITY_BACKLOG.md` and build it once.
6. **Barcode System is a locked, permanent spec** (Disabled / Display Only / Full Workflow modes) — still documented in `PROJECT.md` §3, still **not implemented**. Unchanged status.
7. **Production Data Policy** — production must start with zero business data except workspace/auth setup. This is now **substantially true by construction**: a brand-new real workspace (via onboarding, not Demo) starts empty (`emptyClinicSettings`, zero vendors/products/etc.) — only the explicit Demo Workspace ships pre-seeded data, and it's now hidden from real accounts post-signup (see §3). Worth re-verifying end-to-end against a truly fresh Supabase project rather than assuming.
8. **Available Workflows** (Sale Only / Loan Only / Sale & Loan per product) — still documented, still **not implemented**. Unchanged status.

---

## 5. What's shipped since the last handoff (chronological, commit-hash-anchored)

The old milestone table (Priority-1-through-4, `M2`–`P1-K`) is still accurate for what it covers and is preserved unchanged below in §5a for history. Everything in *this* section happened after it, across several sessions, and is why the project's shape has fundamentally changed.

| Commits | What |
|---|---|
| `e6abe6e`, `aa80e59` | **Rebrand: ImplaTrax.** Full visual identity change (from "ImplantDesk") — color system, logo (light/dark PNG variants in `src/assets/`), favicon/manifest, every in-app string, printable-document branding, tagline ("Every Component. Every Movement. Every Time."). |
| `9d267b4` … `0a05bd4` (many commits) | **Local device auth system, pre-Supabase**: PIN unlock, onboarding wizard, WebAuthn biometrics, `crypto.ts`/`authPersistence.ts`. Several follow-on commits (`36f3e6c`, `647c20b`, `33e0438`, `87846b4`, `aa0bf37`, `cbfc612`) were pure visual polish passes on the same screens — "premium split-screen layout," depth/lighting, tactile keypad. This entire local-only auth system was later **superseded by the Supabase Auth migration** below — the crypto/PIN/biometric *device-pairing* layer survived and is still used (it now pairs a device to a Supabase-authenticated member, not a bare local user), but the persistence model changed. |
| `701ae95` → `481ae0d` | **Supabase migration, schema phase**: dependency + scaffolding, then the full schema/RLS/RPC layer (`supabase/migrations/0001`–`0011` originally). |
| `353034a` | **Rewrite `AuthContext` onto Supabase Auth** + new `src/lib/supabase/` data-access layer. |
| `4f81d80` | **Rewrite `DataContext` onto Supabase** — every call site across the entire app updated for the new async API. This is the single largest mechanical change in the project's history. |
| `a363d14` | **Demo Account Mode + workspace Wipe/Reset Data.** |
| `a2a13c2` | Bugfix: `DataProvider`/`AuthProvider` nesting order was wrong; added an `audit_log.actor_name` fix migration (`0014`). |
| `0c030cc` | Bugfixes found by a full live browser E2E pass over Demo Mode specifically. |
| `dd6a33c` | **Photo attachments**, with mandatory partial-PO-receipt photo enforcement. |
| `9fe7b5d` → `ea71d19` | **Self-generating PDF User Manual** — a comprehensive, searchable, auto-captured-screenshot PDF guide, served statically, viewable without signing in. |
| `438bde6` | Enforce mandatory Batch/Lot on Sales and "Add Implant to Case," matching the existing PO Receiving requirement (a real consistency gap closed). |
| *(this session, 2026-08-03/04, one continuous run)* | **A 6-item UI/UX punch list** the user gave verbatim: (1) standardized all "User Guide" copy to "User Manual"; (2) removed Pakistan from the onboarding country list; (3) added a show/hide eye-icon toggle to every password field app-wide (new `src/components/ui/password-input.tsx`) plus a full password-reset flow (`ResetPasswordPage.tsx`, `requestPasswordReset`/`updatePassword` in `AuthContext`); (4) fixed the PIN keypad shifting position between onboarding/login steps (root cause: `AuthScreenHeader`'s subtitle had no reserved height) and made every auth screen a non-scrolling `h-screen overflow-hidden` shell; (5) changed the default currency from USD to INR everywhere a default is set, and made selecting "India" as country auto-select INR; (6) hid the Demo Workspace from "Your Workspaces" once an account also has a real workspace. Then, in follow-up turns in the same session: global sticky sub-nav tabs (Reports/Settings tab bars moved into `StickyActionHeader`'s `toolbar` slot — see §3) with a shrink-on-scroll effect on the tab pills themselves, and a "← Back" button on the onboarding account step; a real production bug fix — **"Cannot read properties of undefined (reading 'id')" on Product creation** — root-caused to `ProductFormDialog`'s vendor-lookup fallback (`vendors.find(...) ?? vendors[0]`) silently returning `undefined` on any brand-new real workspace, which starts with zero vendors (only Demo ships pre-seeded ones); fixed with a clear user-facing validation error, an `await`ed mutation chain so async Supabase failures are caught instead of silently swallowed, and a stricter `unwrapRow()` helper in `queries.ts`; and a header title/subtitle clipping fix on `StickyActionHeader` (title container needed `overflow-visible` + `leading-normal`, distinct from the *inner* collapse-animation wrapper which correctly keeps its own `overflow-hidden`). All four verification checks (tsc/eslint/vitest/build) were re-run and confirmed passing after every change in this batch; UI changes were additionally verified live via Playwright against either the running dev server or, where auth blocked reaching a page, a temporary isolated debug route rendering the real component with real props (added, verified, then removed before committing — never shipped). Also produced, as explicitly separate one-off deliverables **not part of the app**: two marketing "showreel" HTML files (light Tailwind-CDN carousels, desktop 16:9 + mobile 9:16) and an unrelated Instagram-portfolio template — all delivered as standalone files, not committed to this repo. |

**Note on `main`:** none of the rebrand, the local-auth system, the Supabase migration, Demo Mode, photo attachments, the PDF manual, or this session's punch list has been merged to `main` (§2). It all exists only on `claude/p1-f-doc-generation-scope-dtee4y`.

### 5a. Milestones prior to the rebrand (preserved from the previous handoff, still accurate for what they cover)

| Commit | What |
|---|---|
| `0874b3d` | Initial commit: ImplantDesk 1.8 prototype baseline |
| `c2ebd6a`–`30cb309` | M2–M6: Vitest harness, eliminate static-mock drift, centralize business-rule validation, harden ID generation, type-safe enums |
| `58cba0a` | Phase 3: production-ready Purchase Order workflow — the reference pattern everything since has mirrored |
| `9644056`/`f2d822b` | "Desktop app, not a website" adopted as a permanent principle |
| `816e309` | Full production-readiness audit (`AUDIT.md`) + roadmap reorder around business value — superseded all prior milestone numbering |
| `371689b`–`29084af` | P1-A (Case Lifecycle) → P1-B (Stock-Availability Enforcement) → P1-C (Loans full workflow) → P1-D (Sales full workflow) → P1-E (Batch/Lot Management Screen) |
| `c3ae2b3`/`3354ba1`/`e7f8acd` + P1-L commits | P1-F (Document Generation Foundation) → P1-L (Global Batch/Lot Tracking Setting) |
| `b033ae0` | P1-M: Doctor Master Data + Combobox UX Polish |
| `28bb87e` | P1-N: Inventory Engine — structured movements, Inventory History, Product Details |
| *(P2-A round)* | P2-A Vendor Detail Page, `localStorage` persistence (later superseded by Supabase), Vendor-manufacturers bugfix, Product/Patient Edit (P2-D/P2-E) |
| `bb3b676` | P1-G close-out: Sales Delivery Challan (closes Core Transactional Documents) |
| `ed120f9` | P1-I: Reports — Stock Valuation, Manufacturer-wise, Doctor-wise, Batch/Lot, Expiry |
| `f104f55` | P1-J: Export CSV on every remaining list page |
| `05097c3` | P1-K: Bulk Product CSV import with mandatory preview-before-commit |

Full detail for each is in the previous version of this file (recoverable via `git log -p -- HANDOFF.md` if ever needed) or in `PHASE1_REPORT.md`/`PHASE2_REPORT.md`/`PHASE3_REPORT.md`/`BUGFIX_REPORT.md`.

---

## 6. The roadmap — genuinely open items right now

`DEVELOPMENT_PLAN.md` is still structured around the old Priority 1–4 scheme and is **not** reliable for what's actually left — it predates the Supabase migration and doesn't mention Auth, Demo Mode, or this session's work at all. Treat the list below as the real, current picture instead; verify against the code before starting any of it.

1. **Test coverage for the Supabase-backed `DataContext`/`AuthContext`** — see §2's flagged regression (77 → 34 tests, core mutation and auth logic now untested). Arguably the highest-value next item given how much load-bearing logic now has zero automated coverage.
2. **Access Level / Permissions system** — was scoped in an earlier session (a full `AccessLevel` type, permissions module, `MasterDataEntry` model, wiring into `DataContext`, Users page UI, gating create/edit entry points app-wide for Read Only) but **never actually implemented** — confirmed via `grep -rl "AccessLevel" src/` returning nothing. Don't assume any of this exists. Note it's a *different* concept from the `AccountRole` workspace-membership tiers Auth already has (owner/super-admin/admin/manager/staff/read-only) — re-read both before starting, and confirm with the user whether this is still wanted given `AccountRole` already covers some of the same ground.
3. **P4-A Sticky Stack Primitive** (`DEVELOPMENT_PLAN.md`'s generalized "any number of stacked sticky elements, auto-measuring offsets" primitive) — still not built as a general primitive. In practice, `StickyActionHeader` (§3) now solves the *specific* header+toolbar+tabs case app-wide via one component holding everything in a single sticky block, which sidesteps most of what P4-A was for. Whether a fully general primitive is still worth building, or whether the `StickyActionHeader` pattern is "good enough" and should just be documented as the standard, is a call for the user.
4. **P1-H — Proforma Invoice & Payment Receipt** — still blocked on two open product decisions (Proforma modeling: special Sale state vs. new Quote/Estimate entity; Payment Receipt fields: `amountPaid`/method/balance on `Sale`). Don't start without them.
5. **P2-C — Users Role Editing** (change role / toggle active-inactive from the Users page) — status unclear post-Supabase; the workspace Settings → Workspace tab now has real member management (role change, disable/reactivate, remove, reset PIN — see `WorkspaceTab.tsx`) which may already cover this. Verify against the code before assuming it's still open.
6. **Everything else in the old Priority 2–4 lists** (P2-B Lab Cases Drill-Down, P3-A through P3-F UX polish, P4-B/C/D multi-select + bulk actions + command palette) — statuses unconfirmed since the Supabase migration; re-verify each against the live code rather than trusting `DEVELOPMENT_PLAN.md`'s pre-migration statuses.
7. **Barcode System** and **Available Workflows selector** (§4, items 6 and 8) — locked specs, still not implemented, unchanged status.
8. **`PROJECT.md`, `ARCHITECTURE.md`, `DEVELOPMENT_PLAN.md` are all stale** and describe a client-only prototype that no longer exists — see §9. Refreshing them was out of scope for whatever produced this handoff; it's a legitimate, fairly large follow-up task if the user wants it (they explicitly called for exactly this kind of refresh once before — see the old `HANDOFF.md`'s milestone "Rebrand: update living docs").

**Don't guess any of the above — confirm scope and get explicit approval before writing code**, per §7's process rules, which are unchanged and still in force.

---

## 7. Process rules this project runs under (read carefully — these are not optional)

Unchanged from the previous handoff. Continue exactly this way unless the user explicitly changes it:

1. **One milestone/task at a time.** Before writing code: read the relevant plan section fresh, read every file you intend to modify fresh, then state exact scope + files + edge cases. **Then stop and wait for explicit approval** — unless the user's own instruction already *is* the approval for a small, clearly-scoped ask (this session mostly operated in that mode: the user gave direct, specific requests turn-by-turn rather than pre-approving a `DEVELOPMENT_PLAN.md` milestone).
2. **No scope creep.** No unrelated fixes, no redesigns, no dependency additions, no jumping ahead "while you're in there" — unless you find a real bug in the course of the requested work, in which case fixing it in the same pass is reasonable (this session did this twice: the vendor-crash fix and the header-clipping fix were both found and fixed while doing other requested work, not pre-approved milestones).
3. **If you discover an out-of-scope issue, document it — don't fix it** — unless asked to fix it as its own task.
4. **After implementation:** `npx tsc -b --noEmit`, `npx eslint .`, `npx vitest run`, `npm run build` — all four must pass. Then verify live in a browser for anything UI-facing. **If Supabase isn't configured in your environment** (no `.env.local`, see §2), you cannot reach any real page past onboarding — this session worked around that by rendering the specific component under test via a temporary isolated debug route (added to `App.tsx`, verified with Playwright, then fully removed before committing) or, for JS-logic-only concerns, headless-browser structural checks. Don't skip verification just because the normal path is blocked — find another way to actually see it work.
5. **Review the full diff before committing** (`git status` + `git diff --stat`).
6. **Commit with a detailed message** matching the existing style (multi-paragraph, explains the why, what was verified — see `git log`).
7. **Report what was done and stop** — don't start the next thing without new approval, even if obvious.
8. **A stale local checkout is a recurring, expected event in this environment** (container reclaim between turns) — not a sign anything is wrong. If `git log -1` looks older than you expect, run `git fetch origin <branch>`, confirm safety with `git merge-base --is-ancestor HEAD origin/<branch>`, then `git reset --hard origin/<branch>` and `npm install`. This happened twice in this session alone; it's routine, handle it silently and move on.

---

## 8. Where to actually start

There is no single pre-approved "next milestone" right now — the last several turns of work were direct, specific user requests (a UI/UX punch list, then follow-up fixes), not a `DEVELOPMENT_PLAN.md` item. **Ask the user what they want next.** If they want a suggestion, the highest-leverage candidates, in rough priority order, are:

1. **Rebuild automated test coverage for `DataContext`/`AuthContext`** (§6.1) — this is the biggest real quality gap, and it's invisible unless someone goes looking, which is exactly what happened while writing this handoff.
2. **Refresh `PROJECT.md`/`ARCHITECTURE.md`/`DEVELOPMENT_PLAN.md`** so they stop contradicting the actual app (§9) — the user has asked for exactly this once before (see §5a's "update living docs" milestone) and it'll happen again if left too long.
3. **Decide the fate of the Access Level/Permissions system** (§6.2) — scoped once, never built, may now partly overlap with `AccountRole`.
4. Merge this branch's ~48 unmerged commits toward `main`, if that's actually where the user wants deployment to track from (confirm first — don't merge without explicit permission).

---

## 9. Reference doc index — and exactly how stale each one is

| File | What it's for | Staleness |
|---|---|---|
| `PROJECT.md` | Product philosophy, business rules, terminology | **Significantly stale.** Still frames the app as a "client-only prototype, no backend required." Business-rule/workflow content is probably still mostly accurate; anything about data persistence, backend, or "prototype" status is not. |
| `ARCHITECTURE.md` | Engineering architecture review | **Significantly stale**, same reason — opens by calling the app "client-only… no backend, no API layer." The old `DataContext`-as-mutation-surface framing is still directionally correct (see §3) but the concrete claims about persistence are wrong. |
| `DEVELOPMENT_PLAN.md` | Milestone roadmap (Priority 1–4) | **Stale for "what's left."** Predates Auth/Supabase/Demo Mode/this session entirely. Use §6 of *this* file instead. |
| `AUDIT.md` | Evidence base for the original roadmap reorder | Historical only — findings were about the pre-Supabase codebase. |
| `USABILITY_BACKLOG.md` | Cross-app UX patterns not yet consistently applied | Not verified for staleness this pass — check before trusting. |
| `PHASE1_REPORT.md`/`PHASE2_REPORT.md`/`PHASE3_REPORT.md`/`BUGFIX_REPORT.md` | Historical completion reports | Historical only, fine as history. |

### GitHub access

This session had working `git`/GitHub access throughout (every commit in §5 was pushed directly from this environment). The previous handoff's detailed sandbox-credential workaround section may still be relevant for a *different* kind of session (e.g. a fresh computer-use sandbox with no pre-wired credentials) — if `git push` fails with an auth error, that old guidance (ask the user for a fine-grained PAT scoped to this repo with Contents: Read and write) is the fallback; not reproduced in full here to avoid this document going stale in two directions at once.
