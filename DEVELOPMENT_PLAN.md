# DEVELOPMENT_PLAN.md — ImplantDesk 2.0 Roadmap

> This roadmap evolves the existing prototype into a production-ready application. It is a **refactor-and-extend** plan, not a rewrite.
>
> **Revision history:** Phases 1–3 (below) were executed as planned. On 2026-07-27 the roadmap was reprioritized around business workflows ahead of infrastructure (`PROJECT.md` §2 principle 9), and a UX Interaction Standard was adopted (`PROJECT.md` §2a). Later the same day, a full production-readiness audit (`AUDIT.md`) was conducted and the roadmap was **completely reordered around business value** per explicit direction. **This is the current, authoritative ordering.** The interim Phase 4–9 milestone numbering proposed earlier the same day (M17–M26) is superseded by the Priority 1–4 structure below; M17 (sticky toolbar) is the only one of those that had already shipped, and it's referenced from Priority 3 where it belongs in this ordering.
>
> **Read `AUDIT.md` first if you need the evidence behind any milestone below** — every gap referenced here was verified against the codebase (file:line), not assumed.

---

## Completed ✅

- **Phase 1 — Foundations** (M1 version control, M2 test harness). See `PHASE1_REPORT.md`.
- **Phase 2 — Prototype Integrity Hardening** (M3 static-lookup fix, M4 centralized validation, M5 ID hardening, M6 type-safe status mappings). See `PHASE2_REPORT.md`. Plus a follow-up bugfix (`BUGFIX_REPORT.md`).
- **Phase 3 — Purchase Order Production Workflow** (full status lifecycle, audit history, PO Detail page, WhatsApp/print/photo). See `PHASE3_REPORT.md`. This is the most mature module in the app and the reference pattern several milestones below reuse.
- **M13 — barcodeFormat wiring.**
- **M17 — Sticky search/filter toolbar** on all 10 list pages with a filter row (`src/components/shared/StickyToolbar.tsx`).
- Permanent principles adopted into `PROJECT.md` §2/§2a: desktop-app-feel, priority sequencing, modular advanced features, no-wasted-clicks/UX Interaction Standard. The Barcode System's permanent product rules (Disabled/Display Only/Full Workflow, permanent Product ID, dynamic never-stored generation) are locked in `PROJECT.md` §3 — implementation is Priority 4-adjacent (see M25 note below), not yet scheduled into P1–P4 since it wasn't part of this reprioritization's named scope.

---

## Priority 1 — Finish Core Business Workflows

*Sales, Loans, Purchase Orders, Batch/Lot, Documents, Printing, Import/Export. Purchase Orders are already done (Phase 3) except for a real PDF, which is built here alongside the rest of the document system.*

### P1-A — Case Lifecycle Completion
- **Objective:** Add the missing case-workflow actions: advance a case through its status lifecycle (`planning → surgery-scheduled → in-progress → restoration → completed`, or `cancelled`), and attach implants to a case after creation (not just at creation time). Each transition/attachment appends a real `CaseTimelineEvent`, replacing the static mock timeline for UI-created cases.
- **Files affected:** `src/types/index.ts` (no new types needed — `CaseTimelineEvent` already exists), `src/store/DataContext.tsx` (new `advanceCaseStatus(caseId, status)` and `addImplantToCase(caseId, usage)` actions, scoped and guarded — not a generic `updateCase`), `src/lib/caseWorkflow.ts` (new, mirrors `poWorkflow.ts`'s guard-function pattern), `src/pages/cases/CaseDetailPage.tsx` (status-advance UI + an "Add Implant" action), `src/mocks/cases.ts` (seed history stays as-is; new cases build history live).
- **Risks:** Low-medium — same shape as work already proven twice (PO, and the Loan workflow this same milestone-family will need in P1-C). Main risk is deciding the exact transition graph (can a case skip a status? can `cancelled` happen from any status?) — resolve as part of implementation, consistent with the existing lifecycle description in `PROJECT.md` §3.
- **Dependencies:** None.
- **Estimated complexity:** Medium.
- **Acceptance criteria:**
  - [ ] A case created through the UI can be advanced through every documented status, each transition appending a real, timestamped `CaseTimelineEvent` visible on `CaseDetailPage`.
  - [ ] An implant can be added to a case after creation; it appears in "Implants Used" and (if the product is batch-tracked) captures a lot number.
  - [ ] Illegal transitions (e.g. `completed → planning`) are rejected by a guard function, not just hidden in the UI.
  - [ ] `npx tsc -b --noEmit`, `npm test`, `npm run lint`, `npm run build` all pass; new Vitest coverage for the guard functions and the two new actions.

### P1-B — Stock-Availability Enforcement (Sales & Loans)
- **Objective:** `createSale` and `createLoan` reject an attempt to sell/loan more than `quantityOnHand`, instead of silently clamping stock to zero.
- **Files affected:** `src/store/DataContext.tsx` (`createSale`, `createLoan` — add a pre-check before mutating, following the established throw-before-setState convention from M4), `src/components/sales/SaleFormDialog.tsx` / `src/components/loans/LoanFormDialog.tsx` (surface the rejection as a clear inline message before the user even submits, not just a toast after).
- **Risks:** Low — small, well-understood change to two functions using a pattern already used a dozen times in this codebase.
- **Dependencies:** None.
- **Estimated complexity:** Small.
- **Acceptance criteria:**
  - [ ] Attempting to sell/loan a quantity greater than `quantityOnHand` is rejected with a clear message, both in the form (before submit) and as a `DataContext`-level guard (defense in depth, matching M4's pattern).
  - [ ] Existing valid sales/loans are unaffected — full regression pass on existing tests.
  - [ ] New Vitest coverage asserting the rejection and that stock is unchanged when it fires.

### P1-C — Loans → Full Workflow
- **Objective:** Bring Loans to Purchase-Orders-level maturity: a Loan Detail page (`/loans/:id`), append-only audit history (`LoanEvent`, mirroring `PurchaseOrderEvent`), and status-transition guards, reusing the exact pattern Phase 3 already proved.
- **Files affected:** `src/types/index.ts` (`LoanEvent`, `Loan.history`), `src/lib/loanWorkflow.ts` (new), `src/store/DataContext.tsx` (`createLoan`/`returnLoanLines` append history), `src/pages/loans/LoanDetailPage.tsx` (new) + route, `src/components/loans/LoanStatusActions.tsx` (new, mirrors `POStatusActions.tsx`), `src/pages/loans/LoansPage.tsx` (row navigation), `src/mocks/loans.ts` (synthesized history for seed data, mirroring the PO mock generator).
- **Risks:** Low — this is a close mirror of already-shipped, already-tested work.
- **Dependencies:** None (independent of P1-A/B).
- **Estimated complexity:** Medium.
- **Acceptance criteria:**
  - [ ] Clicking a loan row navigates to a detail page showing line items, full audit history, and lab/date info.
  - [ ] Every loan action (issue, partial return, full return/close) appends a history entry; nothing is ever edited or removed from it.
  - [ ] Illegal transitions rejected the same way Purchase Orders already are.
  - [ ] Full verification suite passes; new tests mirror the existing PO lifecycle test coverage.

### P1-D — Sales → Full Workflow
- **Objective:** A Sale Detail page/route, and a `batchLot` field on the sale-line form for batch-tracked products.
- **Files affected:** `src/pages/sales/SaleDetailPage.tsx` (new, or a Sheet — resolve per the Sheet-vs-route rule: Sales gets a route since it will host document generation, same reasoning as Purchase Orders), `src/pages/sales/SalesPage.tsx` (row navigation), `src/components/sales/SaleFormDialog.tsx` (batchLot input, shown only for batch-tracked products).
- **Risks:** Low.
- **Dependencies:** None.
- **Estimated complexity:** Small-Medium.
- **Acceptance criteria:**
  - [ ] Every sale line (including beyond the first 2) is visible on a real detail view, reachable by clicking the sale.
  - [ ] Selling a batch-tracked product requires (or at least captures) a lot number.
  - [ ] Full verification suite passes.

### P1-E — Batch/Lot Management Screen
- **Objective:** A dedicated view answering "all lots of Product X, remaining quantity, where they came from, where they went" — the biggest traceability gap found in the audit. Also resolves two adjacent dead/decorative fields found during the audit: wire `quantityReserved` to something real, or explicitly retire it; decide the fate of the unused `Product.expiryDate` field (wire it in if in scope, or remove it if not — don't leave dead schema either way).
- **Files affected:** `src/types/index.ts` (`LoanLine` gains `batchLot` for parity with Case/Sale lines), new `src/pages/batches/BatchesPage.tsx` + route + nav entry, a derived-view computation (aggregates existing `batchLot` data — no new stored state, matching the Loan Returns page's "derive, don't duplicate" philosophy).
- **Risks:** Medium — genuinely new feature surface; the `quantityReserved`/`expiryDate` decisions need your input (see `AUDIT.md`'s Open Decisions) before this can be fully scoped.
- **Dependencies:** P1-A helps (case implant usage is one of the three places lot data originates) but isn't strictly blocking.
- **Estimated complexity:** Medium-Large.
- **Acceptance criteria:**
  - [ ] For any batch-tracked product, a user can see every lot ever recorded against it (from receiving, case usage, and sales) and a remaining-quantity figure per lot.
  - [ ] `quantityReserved` and `Product.expiryDate` are either wired to real behavior or explicitly and visibly removed — not left silently decorative.
  - [ ] Full verification suite passes.

### P1-F — Document Generation Foundation
- **Objective:** The shared engine every document in P1-G/H/I is built on: a print-to-PDF approach (extending the proven `window.print()` + `print:` pattern from Purchase Orders with a real `@media print` stylesheet), a `exportToCsv(rows, filename)` utility (Blob-based, no new dependency), and one presentational-component pattern per document type consuming a plain data object (generalizing `poShare.ts`).
- **Files affected:** New `src/lib/documents/` (or similar) — a base layout component, the CSV utility, print stylesheet additions to `src/index.css`. `src/lib/poShare.ts` likely relocates/generalizes into this layer.
- **Risks:** Medium — this is a real technical decision point (confirmed in `AUDIT.md`: print-to-PDF recommended over a new PDF library dependency; revisit only if label-sheet precision proves it insufficient).
- **Dependencies:** None — can start independently, but P1-G needs it.
- **Estimated complexity:** Medium.
- **Acceptance criteria:**
  - [ ] A real `@media print` stylesheet exists and is verified (via a real print preview, not just code review) to produce a clean, readable printout with app chrome (sidebar/topbar) hidden.
  - [ ] `exportToCsv` is a single, reusable utility with no per-page duplication, verified against at least one real dataset (e.g. Inventory movements).
  - [ ] The document-component pattern is proven on one real document (Purchase Order PDF, replacing the disabled stub) before P1-G reuses it elsewhere.

### P1-G — Core Transactional Documents
- **Objective:** Using the P1-F foundation: a real Purchase Order PDF (replacing the "coming soon" stub), a Goods Received Note (from a PO's receiving event), a Sales Invoice and Delivery Challan (from Sale Detail, P1-D), and a Loan Out Slip + Loan Return Receipt (from Loan Detail, P1-C).
- **Files affected:** New per-document components under the P1-F layer; "Generate PDF"/"Print"/"Export" buttons added to `PODetailPage.tsx`, the new `SaleDetailPage.tsx`, and the new `LoanDetailPage.tsx`.
- **Risks:** Low once P1-F/C/D exist — this is mostly template-authoring work at that point, not new architecture.
- **Dependencies:** P1-F (foundation), P1-C (Loan Detail must exist), P1-D (Sale Detail must exist).
- **Estimated complexity:** Medium (six document types, but templated).
- **Acceptance criteria:**
  - [ ] Each of the six documents can be generated (print/PDF) from its correct source record, with accurate data (verified against the source record, not just "renders without error").
  - [ ] The old "Generate PDF — coming soon" stub is gone, replaced by a working button.

### P1-H — Proforma Invoice & Payment Receipt
- **Objective:** The two document types blocked on open product decisions (`AUDIT.md`): Proforma Invoice (recommend modeling as a not-yet-finalized Sale state, avoiding a new entity) and Payment Receipt (needs `amountPaid`/method/balance added to `Sale` first — this is a data-model change, not just a template).
- **Files affected:** `src/types/index.ts` (`Sale` gains payment fields; possibly a `Sale.status` if Proforma needs a distinct pre-final state), `src/store/DataContext.tsx`, the P1-F document layer.
- **Risks:** Medium — genuinely blocked on your decisions from `AUDIT.md`'s Open Decisions list; don't start implementation before those are resolved.
- **Dependencies:** P1-F, P1-D, and your decisions on the two open questions.
- **Estimated complexity:** Medium.
- **Acceptance criteria:**
  - [ ] Both documents can be generated once the underlying data model decision is implemented; a Payment Receipt reflects real payment data, not just the sale total.

### P1-I — Reports: Export + New Report Types
- **Objective:** Add export (PDF/CSV via P1-F) to every existing Reports tab, plus the three genuinely missing report types found in the audit: a proper per-SKU Stock Valuation table (the existing chart is by-category only), a Batch/Lot report (reuses P1-E's data), an Expiry report (if P1-E's `expiryDate` decision keeps that field), a Doctor-wise report, and a Manufacturer-wise report (currently only on the Dashboard — decide whether to keep it there, move it, or show it in both places).
- **Files affected:** `src/pages/reports/ReportsPage.tsx`.
- **Risks:** Low — additive to an existing, working page.
- **Dependencies:** P1-F (export), P1-E (batch/lot and expiry data).
- **Estimated complexity:** Medium.
- **Acceptance criteria:**
  - [ ] Every Reports tab has a working export.
  - [ ] Stock Valuation, Batch/Lot, Expiry (if kept), Doctor-wise, and Manufacturer-wise reports all exist and are reachable from Reports.

### P1-J — Print Everywhere + List-Page Export
- **Objective:** Extend P1-F's print/CSV foundation to every list page (Products, Inventory, Vendors, Patients, Cases, Labs, Users) — a "Print" and/or "Export CSV" action per list, plus the Inventory audit-trail export specifically named as missing.
- **Files affected:** Every list page under `src/pages/`.
- **Risks:** Low — mechanical once P1-F exists.
- **Dependencies:** P1-F.
- **Estimated complexity:** Medium (mechanical, broad).
- **Acceptance criteria:**
  - [ ] Every list page has a working CSV export of its current (filtered) view.
  - [ ] Inventory specifically has a working audit-trail export.

### P1-K — Import
- **Objective:** Scoped deliberately separately from Export (real data-integrity risk). At minimum, bulk Product import (the highest-value case) with validation (SKU/barcode collision handling, required-field checks) and a clear preview-before-commit step — never a silent bulk write.
- **Files affected:** New import UI (likely a dialog on `ProductsPage.tsx`), `src/store/DataContext.tsx` (a batch-safe creation path).
- **Risks:** Medium-high — the one item in this whole Priority 1 list with real data-integrity stakes if done carelessly. Recommend a preview/confirm step is non-negotiable, not a nice-to-have.
- **Dependencies:** None technically, but sequence last within P1 since it's the highest-risk item and everything else de-risks the codebase it lands on.
- **Estimated complexity:** Medium-Large.
- **Acceptance criteria:**
  - [ ] A CSV of products can be imported with a mandatory preview step showing exactly what will be created and flagging any row that fails validation, before anything is committed.
  - [ ] No partial/silent writes — either the whole valid batch commits or nothing does.

---

## Priority 2 — Complete Every Missing Business Screen And Detail Page

### P2-A — Vendor Detail Page
- **Objective:** `/vendors/:id` showing PO history, products supplied, and performance (on-time rate, total orders) — closing the last of the three missing-detail-view gaps from the audit (Sales and Loans are closed in P1).
- **Files affected:** New `src/pages/vendors/VendorDetailPage.tsx` + route, `src/pages/vendors/VendorsPage.tsx` (row/card navigation).
- **Risks:** Low — same proven pattern as Labs/Patients.
- **Dependencies:** None.
- **Estimated complexity:** Small-Medium.
- **Acceptance criteria:** Clicking a vendor opens a detail view showing its PO history and supplied products; no dead clicks remain on the Vendors page.

### P2-B — Lab Detail: Cases Drill-Down
- **Objective:** The "Cases Involving Lab" stat card currently shows a count with no list — add the list, matching the Loan History card's existing pattern on the same page.
- **Files affected:** `src/pages/labs/LabDetailPage.tsx`.
- **Risks:** Very low.
- **Dependencies:** None.
- **Estimated complexity:** Small.
- **Acceptance criteria:** The cases count on Lab Detail is backed by a real, clickable list below it.

### P2-C — Users: Role Editing
- **Objective:** Scoped edit capability for Users — change role, toggle active/inactive — closing the gap that the Role Permissions matrix is currently pure documentation with no enforcement anywhere in the app. (Full auth/session enforcement is out of scope here — that's Phase 9/M14 — but the *data* should be editable, and this is the natural place to start wiring `currentUser.role` checks into at least one real gate, e.g. delete actions once they exist.)
- **Files affected:** `src/store/DataContext.tsx` (new scoped `updateUserRole`/`setUserActive`), `src/pages/users/UsersPage.tsx`.
- **Risks:** Low-medium — first real use of role data for anything beyond documentation; keep scope narrow (this is not full auth).
- **Dependencies:** None.
- **Estimated complexity:** Small-Medium.
- **Acceptance criteria:** A user's role and active status can be changed from the Users page; the change is reflected everywhere that user is referenced.

### P2-D — Product Edit
- **Objective:** Wire up `updateProduct` (already exists in `DataContext`, confirmed dead code with zero callers) to a real edit UI.
- **Files affected:** `src/components/products/ProductFormDialog.tsx` (edit mode) or `ProductDetailSheet.tsx` (inline edit), `src/pages/products/ProductsPage.tsx`.
- **Risks:** Low — the mutation function already exists and is already tested indirectly; this is UI work only.
- **Dependencies:** None.
- **Estimated complexity:** Small.
- **Acceptance criteria:** A product's editable fields can be changed from the UI and the change is immediately reflected everywhere the product is displayed.

### P2-E — Patient Edit
- **Objective:** Correcting contact details (phone, email, address, primary doctor) after creation.
- **Files affected:** `src/components/patients/PatientFormDialog.tsx` (edit mode), `src/store/DataContext.tsx` (new scoped `updatePatient`).
- **Risks:** Low.
- **Dependencies:** None.
- **Estimated complexity:** Small.
- **Acceptance criteria:** A patient's contact fields can be corrected from the UI.

---

## Priority 3 — Polish The UX

*Ship the visible outcome pragmatically here; Priority 4 generalizes into fully reusable primitives once there's a second/third consumer (a bulk-action bar) that actually needs the generalized version.*

### P3-A — Sticky Page Headers
- **Objective:** `PageHeader` sticks to the top of the page (stacked correctly above the M17 toolbar, which already sticks below it) on every page that has one.
- **Files affected:** `src/components/shared/PageHeader.tsx`.
- **Risks:** Low — `PageHeader`'s height is fairly predictable; a pragmatic fixed/known offset is likely sufficient here without the full auto-measuring system (see P4-A).
- **Dependencies:** None (independent of M17, composes with it).
- **Estimated complexity:** Small.
- **Acceptance criteria:** Every page's header stays visible while its content scrolls, correctly stacked with the toolbar where one exists, verified in-browser on at least 3 pages including one with a wrapping/long description.

### P3-B — Sticky Table Headers
- **Objective:** Fix the confirmed bug (`AUDIT.md` item 21): `Table.tsx`'s wrapper `overflow-auto` creates an inert nested scroll context. Change it so vertical scroll correctly bubbles to `<main>`, and table headers stick at the correct offset below the page header + toolbar.
- **Files affected:** `src/components/ui/table.tsx` (the required primitive-level fix — not a per-page workaround, per your standing instruction).
- **Risks:** Medium — need to preserve horizontal scroll for wide tables (Products, Purchase Orders) while removing vertical scroll containment; verify carefully on the widest tables in the app.
- **Dependencies:** P3-A (needs to know the combined header+toolbar offset).
- **Estimated complexity:** Medium.
- **Acceptance criteria:** On every page using `<Table>`, column headers stay visible while scrolling through rows; horizontal scroll for wide tables still works correctly; verified on Products (table view) and Purchase Orders specifically as the widest tables in the app.

### P3-C — Responsive List Pages
- **Objective:** Tables currently have zero mobile accommodation beyond horizontal scroll (confirmed in audit). Add either column-priority hiding (hide less-critical columns below a breakpoint) or a card-view fallback on the widest/most-used tables.
- **Files affected:** `src/components/ui/table.tsx` and/or individual list pages (Products, Purchase Orders, Cases, Loans at minimum).
- **Risks:** Medium — real design decisions about which columns matter most per page; needs verification on an actual narrow viewport, not just code review.
- **Dependencies:** P3-B (don't want to solve responsive layout twice).
- **Estimated complexity:** Medium-Large.
- **Acceptance criteria:** The 3-4 highest-traffic tables are genuinely usable (not just technically scrollable) at a 375px viewport width, verified with a real browser resize + screenshot, not assumed.

### P3-D — "No Wasted Clicks" Final Audit Pass
- **Objective:** After P1/P2 close the major detail-view gaps, do a full pass confirming every remaining clickable-looking element does something — specifically: make Inventory movement rows link to their referenced record (PO/Sale/Loan/Case) since the data already supports it, and re-verify Loan Returns.
- **Files affected:** `src/pages/inventory/InventoryPage.tsx`, spot-checks across the app.
- **Risks:** Low.
- **Dependencies:** P1-C, P1-D (need Loan/Sale detail pages to link to).
- **Estimated complexity:** Small.
- **Acceptance criteria:** Every clickable-styled element in the app (hover state, cursor-pointer) does something meaningful when clicked — verified by an explicit pass, not assumed.

### P3-E — Empty/Loading/Error State Consistency + Root Error Boundary
- **Objective:** Fix the Dashboard widgets' hand-rolled empty states (route through `EmptyState`), add empty-state handling to Users and Reports, and — the single highest-leverage item in this milestone — add a root-level `ErrorBoundary` around the app so a render-phase exception degrades to a recoverable screen instead of blanking the whole app.
- **Files affected:** `src/pages/dashboard/DashboardPage.tsx`, `src/pages/users/UsersPage.tsx`, `src/pages/reports/ReportsPage.tsx`, new `src/components/ErrorBoundary.tsx`, `src/layouts/AppLayout.tsx`.
- **Risks:** Very low — this is cheap, well-understood work; per `PROJECT.md` principle 9's own exception, the ErrorBoundary specifically could reasonably be done earlier/opportunistically rather than waiting for P3 if you'd rather not wait.
- **Dependencies:** None.
- **Estimated complexity:** Small.
- **Acceptance criteria:** A deliberately-thrown test error anywhere in the tree shows a recoverable error screen, not a blank page. Every list/summary page has a consistent empty-state treatment via the shared component.

### P3-F — Search & Filter Consistency
- **Objective:** Extend `⌘K` to search Vendors, Sales, Loans, and Purchase Orders (currently only Products/Patients/Cases/Labs); remove or explain the dead "barcode lookup" placeholder in the palette; decide and apply one consistent rule for filter depth (which pages get dropdown filters beyond search) and for Tabs-vs-Select (Inventory's type filter is the one outlier using Tabs where every other equivalent filter uses Select).
- **Files affected:** `src/components/layout/GlobalSearch.tsx`, filter sections across list pages.
- **Risks:** Low.
- **Dependencies:** None.
- **Estimated complexity:** Medium.
- **Acceptance criteria:** `⌘K` searches every major entity type; the dead barcode-lookup placeholder is either removed or made real; a stated, documented rule governs which pages get which filter pattern, and pages match it.

---

## Priority 4 — Build Reusable Interaction Primitives

### P4-A — Sticky Stack Primitive
- **Objective:** Generalize P3-A/B's pragmatic fixed-offset implementation into the auto-measuring (`ResizeObserver`-based, context-registered) reusable system originally proposed — worth doing once a bulk-action bar (P4-C) needs to interleave as a *conditional* extra layer, since a hardcoded offset breaks the moment a layer's presence becomes dynamic.
- **Files affected:** New `src/hooks/useStickyStack.tsx` (or similar), refactor `PageHeader`/`StickyToolbar`/`Table.tsx` to consume it instead of their P3 fixed offsets.
- **Risks:** Low — this is a refactor of already-working, already-tested UI to a more robust implementation; no user-visible behavior change if done correctly (verify with the exact same before/after checks used for P3-A/B).
- **Dependencies:** P3-A, P3-B (generalizes what they shipped), sequenced just before P4-C which needs it.
- **Estimated complexity:** Medium.
- **Acceptance criteria:** Identical visual behavior to P3-A/B, verified side-by-side; a bulk-action bar can now mount/unmount without any manual offset recalculation anywhere.

### P4-B — Multi-Selection System
- **Objective:** The full reusable desktop-grade multi-select system as specified: click selects, Ctrl/Cmd-click toggles, Shift-click range-selects, click-and-drag draws a rubber-band selection, auto-scroll near container edges while dragging, dragging back updates selection naturally, browser text-selection suppressed during drag. Built and proven on Products (both card and table views) before any rollout.
- **Files affected:** New `src/hooks/useMultiSelect.ts`, new `src/components/shared/RubberBandSelection.tsx` (or similar), `src/pages/products/ProductsPage.tsx` (reference integration).
- **Files affected (open question, needs your confirmation before this starts):** whether plain click selects (desktop convention) or opens (this app's existing default, safer for the non-technical target audience) — see the unresolved tension flagged in the prior UX proposal. Recommend: plain click still opens by default; Ctrl/Cmd-click, Shift-click, or a drag gesture enters selection mode; once selection is non-empty, plain click toggles instead of opening, with a visible "N selected · Clear" affordance to exit.
- **Risks:** High (relative to everything else in this plan) — this is genuinely the most complex interaction engineering in the project so far (hit-testing, drag physics, auto-scroll timing). Build and thoroughly test on one page before spreading it anywhere else, exactly as Phase 3 proved the PO pattern before Loans reused it.
- **Dependencies:** P4-A (bulk bar needs the stack), and your confirmation on the click-select-vs-open question.
- **Estimated complexity:** Large.
- **Acceptance criteria:**
  - [ ] All six listed interactions work correctly on Products, in both card and table view, verified by direct interaction testing (not just code review) — including the originally-reported bug (drag no longer selects browser text).
  - [ ] Selection state survives a re-render (e.g. after an edit) where practical.
  - [ ] The click-select-vs-open resolution matches whatever you confirm, not an assumption.

### P4-C — Roll Out Selection + Bulk Actions
- **Objective:** Apply P4-B to the remaining list pages, paired with real bulk actions each page can support: bulk-cancel draft POs, bulk-mark loans returned, bulk-print barcode labels for selected products (a concrete, real payoff for the whole system — ties directly to the Barcode Labels document from P1-G).
- **Files affected:** Remaining list pages; new `src/components/shared/BulkActionBar.tsx` (mounts into the P4-A stack).
- **Risks:** Medium — mechanical once P4-B is proven, but each page's bulk action needs its own real business-rule guard (e.g. can't bulk-cancel a PO that's already received).
- **Dependencies:** P4-B, P4-A, and the relevant P1 workflow milestone for each bulk action (e.g. bulk loan-return needs P1-C).
- **Estimated complexity:** Large (broad, one page at a time).
- **Acceptance criteria:** Each rolled-out page supports multi-select and at least one real, guarded bulk action; a sticky bulk-action bar appears exactly when selection is non-empty and nowhere else.

### P4-D — Keyboard Shortcuts + Command Palette Actions
- **Objective:** Replace the one-off `⌘K` `addEventListener` with a real registered shortcut layer; extend the command palette to run actions ("New Loan", "New Purchase Order"), not just find records.
- **Files affected:** `src/layouts/AppLayout.tsx`, `src/components/layout/GlobalSearch.tsx`.
- **Risks:** Low-medium.
- **Dependencies:** None blocking, but naturally lands last since it's the lowest-urgency item in the whole reordered plan.
- **Estimated complexity:** Medium.
- **Acceptance criteria:** At least `⌘K`/new-record/escape-to-close are handled through one consistent registration mechanism, not scattered `addEventListener` calls; the palette can execute at least 3 real actions.

---

## Deferred Infrastructure & Backend Work

*Unchanged from the prior reordering — still not abandoned, still resequenced behind everything above per `PROJECT.md` principle 9. See the previous version of this document (git history) for full detail on each if needed; summarized here for continuity.*

- **Services layer, DataContext split, code-splitting** — no user-facing value until a real backend is in scope.
- **Authentication & session-enforced permissions, real backend integration, GS1-compliant barcodes tied to a real product master** — needs real infrastructure decisions outside a roadmap-reordering exercise.

### P-DATA — Remove Seeded Mock Data & Empty-State Production Bootstrap *(placeholder — not yet scoped)*
- **Objective:** Enforce `PROJECT.md` §2b (Production Data Policy): production builds start with zero business data — Products, Doctors, Patients, Labs, Inventory, Sales, Loans, Purchase Orders, and Batch/Lot records all empty — with the sole exception of minimum system configuration (e.g. a Super Admin account or a first-time setup wizard). `src/mocks/*` stays available for development and automated testing but must never load into a production build.
- **Files affected:** Not yet determined — likely `src/store/DataContext.tsx`'s initial-state source, `src/mocks/*` (establishing a hard dev/test-only boundary), build/environment configuration, and a new first-run/setup-wizard flow.
- **Risks:** High relative to effort — touches the seam every other feature reads its initial state from, and needs a real bootstrap mechanism (Super Admin/setup wizard) in an app that currently has no authentication or persistence at all (`PROJECT.md` §9).
- **Dependencies:** None blocking other work directly — but every future milestone (dashboards, reports, P1-E Batch/Lot, search, analytics, and beyond) is a standing dependent: each must be built and verified against a genuinely empty dataset from the start, not patched for it later.
- **Estimated complexity:** Not yet estimated — needs its own scoping session before implementation begins.
- **Note:** This is a placeholder only, added so the Production Data Policy (`PROJECT.md` §2b) isn't silently forgotten while other milestones proceed. It is not yet prioritized into the Priority 1–4 sequencing above — that's a decision for a future session.

---

## Summary Table

| Priority | Milestone | Complexity | Key Dependency |
|---|---|---|---|
| 1 | P1-A Case Lifecycle Completion | M | — |
| 1 | P1-B Stock-Availability Enforcement | S | — |
| 1 | P1-C Loans → Full Workflow | M | — |
| 1 | P1-D Sales → Full Workflow | S-M | — |
| 1 | P1-E Batch/Lot Screen | M-L | your decisions (reserved stock, expiry) |
| 1 | P1-F Document Generation Foundation | M | — |
| 1 | P1-G Core Transactional Documents | M | P1-F, P1-C, P1-D |
| 1 | P1-H Proforma & Payment Receipt | M | your decisions (proforma model, payment fields) |
| 1 | P1-I Reports Export + New Reports | M | P1-F, P1-E |
| 1 | P1-J Print Everywhere + List Export | M | P1-F |
| 1 | P1-K Import | M-L | (sequenced last in P1 — highest risk) |
| 2 | P2-A Vendor Detail Page | S-M | — |
| 2 | P2-B Lab Cases Drill-Down | S | — |
| 2 | P2-C Users Role Editing | S-M | — |
| 2 | P2-D Product Edit | S | — |
| 2 | P2-E Patient Edit | S | — |
| 3 | P3-A Sticky Page Headers | S | — |
| 3 | P3-B Sticky Table Headers | M | P3-A |
| 3 | P3-C Responsive List Pages | M-L | P3-B |
| 3 | P3-D No-Wasted-Clicks Pass | S | P1-C, P1-D |
| 3 | P3-E Empty/Loading/Error States + ErrorBoundary | S | — |
| 3 | P3-F Search & Filter Consistency | M | — |
| 4 | P4-A Sticky Stack Primitive | M | P3-A, P3-B |
| 4 | P4-B Multi-Selection System | L | P4-A, your decision (click-select-vs-open) |
| 4 | P4-C Roll Out Selection + Bulk Actions | L | P4-B, relevant P1 milestones |
| 4 | P4-D Keyboard Shortcuts + Palette Actions | M | — |
| Unprioritized | P-DATA Remove Seeded Data & Empty-State Bootstrap *(placeholder)* | TBD | `PROJECT.md` §2b |

**Open decisions needed before/during implementation** (full detail in `AUDIT.md`): case-transition scope, oversell hard-block vs. warning, Proforma modeling, Payment Receipt data fields, `quantityReserved`/`expiryDate` fate, click-select-vs-open for multi-select.

**Recommended immediate next step:** P1-A (Case Lifecycle Completion) — the single most consequential gap found in the audit, and fully independent of every open decision above.
