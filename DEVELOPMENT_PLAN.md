# DEVELOPMENT_PLAN.md — ImplantDesk 2.0 Roadmap

> This roadmap evolves the existing prototype (referred to throughout as **ImplantDesk 1.8**) into a production-ready application. It is a **refactor-and-extend** plan, not a rewrite — see `ARCHITECTURE.md` §5 for what's already strong and worth preserving, and §6–§8 for the specific findings each milestone below addresses.
>
> **No code has been changed to produce this plan.** Every milestone is scoped but not started. Complexity estimates assume roughly one full-time engineer already familiar with this codebase; scale down for a team, scale up if onboarding time is included. They are directional, for sequencing and conversation, not commitments.
>
> **Sequencing rule:** phases are ordered by dependency, not just priority. Do not skip ahead to Phase 4/5 work before Phase 1–2 land — several early milestones exist specifically to make the later, riskier ones safe (a test harness before refactoring the data layer; validation centralized in `DataContext` before a second caller of those actions exists).

---

## Phase 1 — Foundations
*Nothing else in this plan should start before these two land. They are cheap and de-risk everything downstream.*

### M1 — Version Control & Safety Net
- **Objective:** Initialize git, make an initial commit of the current state exactly as-is (so "ImplantDesk 1.8" is a real, addressable, revertible baseline), and put branch/PR conventions in place before any refactor touches the code.
- **Files affected:** New `.git/`; no source changes. Possibly a `README.md` if one doesn't exist for contributor onboarding.
- **Risks:** Essentially none — this is the lowest-risk item in the entire plan. The only risk is *not* doing it first: every milestone after this one becomes harder to review and impossible to cleanly revert without it.
- **Dependencies:** None. This is the literal first task.
- **Estimated complexity:** Trivial (< 1 hour).

### M2 — Data-Layer Test Harness
- **Objective:** Stand up a test runner (Vitest is the natural choice given the existing Vite toolchain) and write unit tests for `DataContext`'s action functions — the part of the app that encodes the "inventory accuracy" business rules (`PROJECT.md` §2). Cover at minimum: `adjustStock`, `createPurchaseOrder`/`receivePurchaseOrder` (including partial-receipt status transitions), `createLoan`/`returnLoanLines` (including partial-return and lost-item paths), `createSale`. Assert both the state mutation *and* the paired `InventoryMovement` (correct type, sign, reference).
- **Files affected:** New `vitest.config.ts`, new `package.json` devDependency + script, new `src/store/DataContext.test.tsx` (or a `test/` folder per `ARCHITECTURE.md` §9). No production code changes.
- **Risks:** Low. The main risk is scope creep — this milestone is about covering the mutation logic in `ARCHITECTURE.md` §6.5, not about achieving high coverage everywhere; resist the urge to also test every page component here.
- **Dependencies:** M1 (so the harness's own setup is committed cleanly).
- **Estimated complexity:** Small–Medium (1–2 days).

---

## Phase 2 — Prototype Integrity Hardening
*Fixes the specific bugs and fragile patterns documented in `ARCHITECTURE.md` §6/§7, now safely, with M2's tests catching regressions.*

### M3 — Eliminate Static-Mock Lookup Drift
- **Objective:** Fix the confirmed bug class in `ARCHITECTURE.md` §6.1: components resolving entities via `*ById` helpers imported from `src/mocks/*.ts` (closed over the static seed array) instead of via `useData()` (the live store). Remove or re-scope the `*ById` exports from the mocks layer so this class of bug can't recur, then fix each verified call site: `DashboardPage.tsx` (product/lab/user lookups in Recent Activity and Outstanding Loans), `ProductDetailSheet.tsx` (vendor lookup), and audit the remaining `mocks/*` imports found in `pages/` and `components/` for the same pattern.
- **Files affected:** `src/mocks/products.ts`, `src/mocks/labs.ts`, `src/mocks/users.ts`, `src/mocks/vendors.ts`, `src/mocks/patients.ts`, `src/mocks/loans.ts`, `src/mocks/cases.ts`, `src/mocks/purchaseOrders.ts`, `src/mocks/sales.ts` (remove/rescope `*ById` exports); `src/pages/dashboard/DashboardPage.tsx`, `src/components/products/ProductDetailSheet.tsx`, `src/pages/inventory/InventoryPage.tsx`, `src/pages/labs/*`, `src/pages/cases/CaseDetailPage.tsx`, `src/components/layout/Topbar.tsx`, `src/components/layout/GlobalSearch.tsx`, and other confirmed call sites (see `ARCHITECTURE.md` §6.1 for the full list).
- **Risks:** Medium — this touches ~10 files across the app, and it's exactly the kind of change that's easy to do incompletely (fix the two reported instances, miss a third). Mitigate by treating "no file imports a `*ById` helper from `mocks/`" as the literal, greppable completion criterion, not a best-effort pass.
- **Dependencies:** M1, M2 (tests should exist to confirm live-vs-stale lookups behave identically for seeded data before/after).
- **Estimated complexity:** Medium (2–3 days).

### M4 — Centralize Business-Rule Validation in `DataContext`
- **Objective:** Move validation currently living only in UI dialogs (`ARCHITECTURE.md` §6.2) into the `DataContext` action functions themselves: `adjustStock` should reject an empty reason; `createLoan` should reject a non-Lab recipient; similar treatment for any other rule currently enforced only client-side in a form. UI-level validation stays (for good UX — don't wait for a rejected mutation to tell the user), but the mutation layer becomes the actual source of truth, not just the dialogs.
- **Files affected:** `src/store/DataContext.tsx` (all action functions); no page/dialog changes required, though dialogs can be simplified once they're no longer the *only* enforcement point.
- **Risks:** Low-medium. Mostly mechanical, but requires care that error signaling from `DataContext` actions (which currently return void/the created record, never an error) gets a real shape — e.g. throwing, or a discriminated-union return — decide the convention here since every later action added to `DataContext` will follow it.
- **Dependencies:** M2 (write the "rejects an empty reason" test *before* the fix, so it's a real regression test, not a retrofit).
- **Estimated complexity:** Medium (2–3 days), mostly because of the error-signaling design decision, not the validation logic itself.

### M5 — Harden ID / Sequence Number Generation
- **Objective:** Replace `array.length + 1`-derived numbering (PO/loan/sale numbers, patient codes, Case IDs — `ARCHITECTURE.md` §6.3) with a monotonically-increasing counter independent of array length, isolated behind one small module. This is what makes M11 (delete flows) and M15 (backend integration) safe to build later.
- **Files affected:** `src/store/DataContext.tsx` (all `nextId`/number-generation call sites); possibly a new `src/lib/idGenerator.ts`.
- **Risks:** Low. Self-contained, well-covered by M2's tests once written for this milestone specifically (assert two rapid creates never collide).
- **Dependencies:** M2.
- **Estimated complexity:** Small (< 1 day).

### M6 — Type-Safe Status & Enum Mappings
- **Objective:** Fix `ARCHITECTURE.md` §6.4 — make `StatusBadge`'s `STATUS_CONFIG` (and any similar `Record<string, ...>` mapping over a status union, e.g. `InventoryPage`'s `TYPE_LABEL`/`TYPE_VARIANT`) exhaustive at the type level, so adding a new enum value without updating the mapping is a compile error, not a silent `'outline'` fallback in production.
- **Files affected:** `src/components/shared/StatusBadge.tsx`; `src/pages/inventory/InventoryPage.tsx` (`TYPE_LABEL`/`TYPE_VARIANT`); a quick audit of `src/pages/**` for any other hand-rolled `Record<SomeUnion, ...>` that should be exhaustive.
- **Risks:** Very low — purely additive type strictness, no behavior change for currently-valid data.
- **Dependencies:** None beyond M1.
- **Estimated complexity:** Trivial–Small (half a day).

---

## Phase 3 — Architecture Evolution
*Builds the seams `ARCHITECTURE.md` §8–§9 recommends, so Phase 5 (real backend) is a swap, not a rewrite. Ordered so each milestone's output is what the next one needs.*

### M7 — Introduce a Services Layer Behind `DataContext`
- **Objective:** Extract `DataContext`'s action bodies into a `src/services/` module per domain (`inventoryService`, `purchasingService`, `loanService`, `salesService`, `caseService`, ...), each exposing the same function signatures `DataContext` exposes today. `DataContext` becomes a thin adapter: it holds React state and calls into the services, which remain mock-backed for now. This is purely a seam — behavior does not change.
- **Files affected:** New `src/services/*.ts`; `src/store/DataContext.tsx` (becomes thinner, delegates to services).
- **Risks:** Medium — a large mechanical refactor touching the app's most central file. The main risk is subtle behavior drift during extraction (e.g. losing a `useCallback` dependency correctness). M2's tests are the direct mitigation — they should pass unchanged before and after this milestone, since it's explicitly not supposed to change behavior.
- **Dependencies:** M2 (tests must exist and pass first — this is the milestone they're specifically protecting), M4, M5 (cleaner to extract validated, ID-hardened actions than to extract-then-fix).
- **Estimated complexity:** Large (4–6 days) — mechanical but touches every domain.

### M8 — Split/Slice `DataContext` for Render Scalability
- **Objective:** Address `ARCHITECTURE.md` §7.1/§8.5 — eliminate the "every state change re-renders every `useData()` consumer" behavior. Recommended approach: split into per-domain contexts (Inventory/Products, Purchasing, Care, Commerce, System) composed in one `DataProvider`, each independently memoized. Alternative: keep one context but add granular selector hooks. Pick one explicitly (this doc recommends the split-context approach for clearer domain boundaries, matching the `services/` split from M7).
- **Files affected:** `src/store/DataContext.tsx` (split into `src/store/*Context.tsx` per domain); every page/component calling `useData()` (import path changes only, logic unchanged, since each still calls a domain hook e.g. `useInventory()`, `useLoans()`).
- **Risks:** Medium-high — the widest-blast-radius change in the whole plan by file count (every consumer of `useData()` needs its import updated, even if trivially). Do this as one dedicated milestone with no other logic changes bundled in, so any regression is obviously attributable to it.
- **Dependencies:** M7 (splitting the services first makes the context split a near-mechanical follow-on).
- **Estimated complexity:** Large (4–5 days), mostly due to breadth, not depth.

### M9 — Route-Level Code-Splitting & Bundle Size
- **Objective:** Address the confirmed 1.3 MB single-chunk build (`ARCHITECTURE.md` §7.6) by converting `App.tsx`'s route imports to `React.lazy()` + `Suspense`, and checking whether heavier libraries used on a subset of pages (`recharts` on Dashboard/Reports, `jsbarcode`/`qrcode` on Product Detail) benefit from being split further.
- **Files affected:** `src/App.tsx`; possibly a small shared `<RouteFallback/>` loading component.
- **Risks:** Low. Vite/React Router support this well; main risk is a flash-of-loading-state on fast connections if fallback UI isn't tuned, which is a UX polish detail, not a functional risk.
- **Dependencies:** None functionally, but sequenced here so it lands after the bigger structural refactors (M7/M8) rather than before, to avoid re-touching `App.tsx` twice.
- **Estimated complexity:** Small (1 day).

### M10 — Error Boundaries & Resilience
- **Objective:** Add a top-level `ErrorBoundary` (and, once M15 introduces real network calls, per-route or per-panel boundaries) so a render failure degrades to a recoverable error screen instead of a white screen (`ARCHITECTURE.md` §7.5). Cheap now; foundational once fallible network requests exist.
- **Files affected:** New `src/components/ErrorBoundary.tsx`; `src/App.tsx` or `src/layouts/AppLayout.tsx` to wrap routes.
- **Risks:** Very low.
- **Dependencies:** None.
- **Estimated complexity:** Small (< 1 day).

---

## Phase 4 — Feature Completion (Prototype → MVP Scope)
*These are the features `PROJECT.md` §10 already identifies as the next layer of prototype work. Sequenced here — after Phase 2/3 — because each one is meaningfully safer to build on a hardened data layer than on the 1.8 baseline directly.*

### M11 — Edit/Delete Flows with Enforced Role Gating
- **Objective:** Add edit and delete capability for the core entities (Products, Patients, Cases, Vendors, Labs, etc.), with delete gated to the mock `currentUser.role === 'admin'` (Super Admin), per the intent already documented in `content/helpText.ts`'s `ICON_HELP.delete` entry and `PROJECT.md` §3/§10. This is the first feature milestone that *requires* M5 (ID/sequence hardening) — deletion is exactly the case that breaks `array.length`-based numbering.
- **Files affected:** `src/store/DataContext.tsx` (new `updateX`/`deleteX` actions per entity, or extend the M7 services); every `<Module>Page.tsx` and detail page (new edit/delete UI affordances); `src/pages/users/UsersPage.tsx` region (role-gating logic needs a real home — likely a small `usePermissions()`/`can()` helper reading `currentUser.role` against the existing `PERMISSIONS` matrix data).
- **Risks:** Medium — this is the first place the Role Permissions matrix (currently pure documentation, `ARCHITECTURE.md`/`PROJECT.md` note it's unenforced) becomes real, load-bearing logic. Decide the `can(action, role)` API shape carefully here since M13 (real auth) will later replace *how* the role is known, not *how* it's checked.
- **Dependencies:** M4, M5, M7 (build this against the services layer, not directly against raw `setState`, so M15's backend swap doesn't need to re-derive it).
- **Estimated complexity:** Large (5–7 days) — spans every module, even though each individual module's edit/delete is small.

### M12 — Batch/Lot Inventory Management Screen
- **Objective:** Build the dedicated batch/lot view `PROJECT.md` §9/§10 flags as missing — a screen showing all lots per product and remaining quantity, replacing today's free-text-only `batchLot` capture at point of use.
- **Files affected:** New `src/pages/batches/BatchesPage.tsx` (or similar) + route in `App.tsx` + nav entry in `components/layout/nav.ts`; likely a new `ProductBatch`-backed action in the services layer (the `ProductBatch` type already exists in `types/index.ts:58-65` but nothing currently constructs it — this milestone is what makes it real).
- **Risks:** Medium — this is genuinely new feature surface (not a refactor), so it carries normal feature-build risk (data model gaps discovered mid-build, UX decisions about lot depletion/FIFO not yet made). Recommend a short design pass before implementation.
- **Dependencies:** M7 (build against services, not raw context), M11 is not a hard dependency but sequencing after it means edit/delete patterns are already established to reuse.
- **Estimated complexity:** Large (4–6 days), driven mainly by undecided product/UX questions, not raw engineering effort.

### M13 — Wire `ClinicSettings.barcodeFormat` Through to Rendering ✅ Done
- **Objective:** Close the gap `PROJECT.md` §9 documents: the Settings page already lets a user choose CODE128/CODE39/EAN13, but `BarcodeDisplay` always renders CODE128 regardless. Make the setting actually control rendering.
- **Files affected:** `src/components/shared/Barcode.tsx`, `src/pages/settings/SettingsPage.tsx` (no change needed if the setting UI already exists — verify), any component consuming `BarcodeDisplay`.
- **Risks:** Low — small, well-bounded, `jsbarcode` already supports the other formats natively.
- **Dependencies:** None.
- **Estimated complexity:** Small (1 day).

---

## Phase 5 — Real Backend / MVP Cutover
*The largest, most externally-dependent phase — deliberately last. Everything in Phases 1–4 exists to make this phase a swap of implementations behind stable seams, not a rewrite.*

### M14 — Authentication & Session-Enforced Permissions
- **Objective:** Replace the hardcoded `currentUser` mock (`src/mocks/users.ts`) with a real login flow and session, and make the `can()`/permission-checking logic built in M11 read from a real authenticated session instead of a static mock user.
- **Files affected:** New auth flow (login screen/route, session storage strategy — decision needed: cookie-session vs. token, out of scope for this doc to pick unilaterally); `src/store/DataContext.tsx` or a new `AuthContext`; every place `currentUser` is currently imported directly from `src/mocks/users.ts` (a grep-able, bounded set: `Topbar.tsx`, `DataContext.tsx`'s action functions, `AdjustmentDialog`/similar dialogs recording `performedBy`).
- **Risks:** High — this is the first milestone with a real security surface (session handling, credential storage) and the first to require backend infrastructure decisions (M15) to even land fully; can start UI-first (login screen against a mock auth service) and cut over once M15's backend exists.
- **Dependencies:** M11 (permission-checking API must already exist and be in use), ideally sequenced alongside the start of M15.
- **Estimated complexity:** X-Large (1–2+ weeks) — genuinely new infrastructure, not a refactor of existing prototype code.

### M15 — Backend & Persistence Integration
- **Objective:** Stand up a real backend/database and swap the mock-backed implementations in `src/services/*` (from M7) for network-calling implementations (a data-fetching library such as TanStack Query is a natural fit given the app already uses React Query-adjacent patterns nowhere yet, but the services seam makes the choice low-stakes). This is the milestone `ARCHITECTURE.md` §1/§5.4 identifies as the payoff for the whole plan: because pages call `useData()`/service functions with stable signatures, this milestone should not require page-level rewrites — only the implementation behind `src/services/*` and `src/store/*Context.tsx` changes.
- **Files affected:** `src/services/*.ts` (new network-backed implementations), `src/store/*Context.tsx` (data source becomes fetched, not seeded), backend/infra (new, outside this repo's current scope), `src/mocks/*` (demoted to test fixtures / local-dev-only seed data, per `ARCHITECTURE.md` §9).
- **Risks:** Very high — the largest single milestone in the plan, with real infrastructure, deployment, and data-migration decisions that this document does not attempt to make (backend language/framework, hosting, database choice are product/infra decisions, not architecture-review conclusions). Recommend this milestone be broken into its own dedicated planning pass once reached, rather than executed directly from this roadmap's current level of detail.
- **Dependencies:** M7, M8 (the services/context split is the direct prerequisite this milestone cashes in), M14 (session-aware requests).
- **Estimated complexity:** X-Large (multiple weeks; genuinely out of scope to estimate precisely without infra decisions made first).

### M16 — Real Scannable Barcodes & Audit Export
- **Objective:** Two smaller MVP-tier items bundled together since both are "finishing touches" once M15 lands: (a) generate real GS1/CODE128-compliant barcodes tied to an actual product master instead of the current deterministic-but-fake payloads (`ARCHITECTURE.md`/`PROJECT.md` §9); (b) a CSV/PDF export of the Stock Movement log for compliance record-keeping.
- **Files affected:** `src/store/DataContext.tsx`/`services/inventoryService.ts` (barcode generation moves server-side or to a compliant client library), `src/components/shared/Barcode.tsx`; new export action on `src/pages/inventory/InventoryPage.tsx`.
- **Risks:** Low-medium — barcode standards compliance (GS1) has real correctness requirements worth a brief specialist review; export is low-risk, well-trodden functionality.
- **Dependencies:** M15 (barcode generation as a compliant, unique identifier scheme needs a real backend to guarantee uniqueness across the fleet, not just within one client's mock counter).
- **Estimated complexity:** Medium (2–3 days combined), assuming M15 is already in place.

---

## Summary Table

| # | Milestone | Phase | Complexity | Hard Dependencies |
|---|---|---|---|---|
| M1 | Version Control & Safety Net | 1 | Trivial | — |
| M2 | Data-Layer Test Harness | 1 | S–M | M1 |
| M3 | Eliminate Static-Mock Lookup Drift | 2 | M | M1, M2 |
| M4 | Centralize Business-Rule Validation | 2 | M | M2 |
| M5 | Harden ID/Sequence Generation | 2 | S | M2 |
| M6 | Type-Safe Status/Enum Mappings | 2 | Trivial–S | M1 |
| M7 | Services Layer Behind DataContext | 3 | L | M2, M4, M5 |
| M8 | Split/Slice DataContext | 3 | L | M7 |
| M9 | Route-Level Code-Splitting | 3 | S | (after M7/M8) |
| M10 | Error Boundaries & Resilience | 3 | S | — |
| M11 | Edit/Delete + Role Gating | 4 | L | M4, M5, M7 |
| M12 | Batch/Lot Management Screen | 4 | L | M7 |
| M13 | Wire barcodeFormat to Rendering | 4 | S | — |
| M14 | Authentication & Permissions | 5 | XL | M11 |
| M15 | Backend & Persistence Integration | 5 | XL | M7, M8, M14 |
| M16 | Real Barcodes & Audit Export | 5 | M | M15 |

**Recommended immediate next step:** M1 and M2, in that order, before any further discussion of feature work — everything else in this plan depends on having both a revertible baseline and a test harness that can prove the hardening milestones (Phase 2) didn't change behavior.
