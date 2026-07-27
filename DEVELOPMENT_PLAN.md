# DEVELOPMENT_PLAN.md — ImplantDesk 2.0 Roadmap

> This roadmap evolves the existing prototype (referred to throughout as **ImplantDesk 1.8**) into a production-ready application. It is a **refactor-and-extend** plan, not a rewrite.
>
> **Revision history:** Phases 1–2 were executed exactly as originally planned. Phase 3 was inserted by explicit direction (a production-ready Purchase Order workflow) ahead of the originally-planned Architecture Evolution phase. On 2026-07-27, the remaining roadmap was **reprioritized around complete business workflows and usability, ahead of infrastructure work with no user-facing effect yet** — see `PROJECT.md` §2, principle 9. The active roadmap below (Phases 4–9) supersedes the original Phase 3–5 milestone order; the original content is preserved, not deleted, in the **Deferred Infrastructure & Backend Work** appendix, since none of it is abandoned — only resequenced.
>
> Complexity estimates assume roughly one full-time engineer already familiar with this codebase; directional, not commitments.

---

## Phase 1 — Foundations ✅ Done
### M1 — Version Control & Safety Net ✅
### M2 — Data-Layer Test Harness ✅
*(See `PHASE1_REPORT.md` for what shipped and how it was verified.)*

---

## Phase 2 — Prototype Integrity Hardening ✅ Done
### M3 — Eliminate Static-Mock Lookup Drift ✅
### M4 — Centralize Business-Rule Validation in `DataContext` ✅
### M5 — Harden ID/Sequence Number Generation ✅
### M6 — Type-Safe Status & Enum Mappings ✅
*(See `PHASE2_REPORT.md`. A follow-up fix — the patient Date-of-Birth crash found during M5 testing — is in `BUGFIX_REPORT.md`.)*

---

## Phase 3 — Purchase Order Production Workflow ✅ Done
*Inserted ahead of the original Architecture Evolution phase by explicit direction: make Purchase Orders/stock receiving production-ready first.*

Built: full status lifecycle (Draft → Submitted → Confirmed → Partially/Fully Received, or Cancelled) with guard functions (`src/lib/poWorkflow.ts`) shared between `DataContext` enforcement and UI button visibility; timestamp-based PO IDs (`YYYYMMDDHHmm`, collision-safe); append-only audit history stored on each `PurchaseOrder` record; a PO Detail page (`/purchase-orders/:poId`) with line items, history timeline, and a Share & Export panel (working WhatsApp-copy and Print, a prepared-but-stubbed Generate PDF, and working photo attachment); confirmation dialogs on Submit/Confirm/Cancel, reusing and improving the shared `ConfirmDialog` (autofocus the fast path, safe-default for destructive actions). See `PHASE3_REPORT.md` for full detail, verification, and one explicit scope note (the `Submitted` status was kept rather than removed).

### M13 — Wire `ClinicSettings.barcodeFormat` Through to Rendering ✅ Done
Folded in alongside Phase 3/M11-prep work. Superseded in spirit by Phase 7/M25 below, which replaces the simple format-only setting with the full modular Barcode System — M13's rendering-wiring code (`BarcodeDisplay` accepting a `format` prop) is exactly the seam M25 builds on, not wasted work.

---

## Phase 4 — Complete the Core Business Workflows
*Business workflows and usability now outrank infrastructure work with no user-facing effect yet (`PROJECT.md` §2, principle 9). This phase brings Loans, Traceability, and Sales up to the same production bar Purchase Orders reached in Phase 3, plus one universal, cheap, high-frequency usability win.*

### M17 — Sticky List-Page Toolbar
- **Objective:** Search/filter/action bars stay visible while scrolling, on every list page, via one shared layout pattern (not copy-pasted per page).
- **Reasoning / user impact:** Highest-frequency win available — every list page has this exact gap today (`AppLayout`'s `<main>` is the sole scroll container), and it's felt on every visit to every module, every day.
- **Files affected:** A shared layout primitive (e.g. a `StickyToolbar` wrapper or a Tailwind utility pattern applied consistently), then each list page (`ProductsPage`, `InventoryPage`, `PurchaseOrdersPage`, `PatientsPage`, `CasesPage`, `LabsPage`, `VendorsPage`, `SalesPage`, `LoansPage`, `UsersPage`) adopts it.
- **Risks:** Low — CSS/layout change, no business logic touched.
- **Dependencies:** None. Can start immediately.
- **Estimated complexity:** Small.

### M18 — Loans → Production-Ready Workflow
- **Objective:** Bring Loans to the same standard Purchase Orders reached in Phase 3: a Loan Detail page, append-only audit history (`LoanEvent`, mirroring `PurchaseOrderEvent`), explicit status-transition guards (`canIssueLoan`/`canReturnLoan`/etc., mirroring `src/lib/poWorkflow.ts`), and confirmation dialogs on issue/return actions.
- **Reasoning / user impact:** Named directly as a priority. Loans has the exact multi-status shape (`open` → `partially-returned` → `closed`) Purchase Orders had *before* Phase 3, but lacks the detail view, audit trail, and guarded transitions POs now have — the highest-confidence, lowest-risk big win available, since the pattern is already proven.
- **Files affected:** `src/types/index.ts` (`LoanEvent` type, `Loan.history`), `src/store/DataContext.tsx` (`createLoan`/`returnLoanLines` append history + gain guards; extend the existing `poEvent`-style helper pattern), new `src/lib/loanWorkflow.ts`, new `src/pages/loans/LoanDetailPage.tsx` + route, new `src/components/loans/LoanStatusActions.tsx` (mirrors `POStatusActions.tsx`), `src/pages/loans/LoansPage.tsx` (row navigation + shared actions component), `src/mocks/loans.ts` (synthesized history for seed data, mirroring the PO mock generator's date-chaining).
- **Risks:** Low-medium — this is a close mirror of already-shipped, already-tested Phase 3 work, not a novel design. Main risk is the same one Phase 3 already solved once (don't throw inside a `setState` updater; validate before calling `setState`) — reuse that exact pattern, don't reinvent it.
- **Dependencies:** None new — reuses `ConfirmDialog`, generalizes the `PurchaseOrderEvent`/`poWorkflow.ts` pattern.
- **Estimated complexity:** Medium.

### M19 — Batch/Lot Traceability Screen
*(Elevates and replaces the original plan's M12 — same underlying gap, now sequenced far earlier given "traceability" was named directly as a priority.)*
- **Objective:** A dedicated view — all lots of a product, remaining quantity, where each lot came from (which PO) and where it went (which Case/Sale/Loan) — replacing today's free-text-only `batchLot` capture with no aggregate view.
- **Reasoning / user impact:** Named directly as a priority. This is the single biggest traceability gap today — for a dental/medical inventory tool, lot-level traceability is close to core to the product's reason to exist (recalls, compliance, "which patients received lot X"), not a nice-to-have. High-stakes even though lower-frequency than daily workflows.
- **Files affected:** `src/types/index.ts` (`LoanLine` currently has no `batchLot` field — Case and Sale lines already do; add it for parity), new `src/pages/batches/BatchesPage.tsx` (or similar) + route + nav entry, a derived-view computation (no new stored state needed — this aggregates existing `CaseImplantUsage`/`SaleLine`/`LoanLine` `batchLot` data plus receiving history, matching the app's existing "derive, don't duplicate" philosophy already used for the Loan Returns page).
- **Risks:** Medium — genuinely new feature surface, not a refactor; some UX questions need a decision during build (how to handle products with `batchTracked: false`, FIFO display order, what "remaining quantity" means when lots aren't tracked at receipt time granularity today).
- **Dependencies:** None blocking.
- **Estimated complexity:** Medium.

### M20 — Sales Receipt/Share Polish
- **Objective:** Extend the WhatsApp-copy/Print pattern already built for Purchase Orders (`src/lib/poShare.ts`) to Sales — generalize it into a reusable summary-builder, then add a lightweight "view & share a sale" surface.
- **Reasoning / user impact:** Sales already works correctly (single dialog, correct stock/audit behavior) — this isn't fixing a broken workflow, it's cheaply reusing an already-proven pattern. Medium impact: real daily convenience (share/print a receipt), not a completeness gap.
- **Files affected:** `src/lib/poShare.ts` (generalize/rename, e.g. `src/lib/recordShare.ts`), `src/pages/sales/SalesPage.tsx` or a new `SaleDetailSheet` (Sheet, not a route — Sales has no multi-step status lifecycle needing a deep link, so this is also the first real application of the Sheet-vs-route rule from M21 below).
- **Risks:** Low.
- **Dependencies:** None; can reuse M18/M19 patterns opportunistically if built after them.
- **Estimated complexity:** Small.

---

## Phase 5 — Cross-App Desktop Interaction Infrastructure
*Sequenced after Phase 4 so these get designed against real, now-completed workflow screens (Loans + POs both fully built) instead of in the abstract. Full detail and reasoning for each item lives in `USABILITY_BACKLOG.md` — this section is the roadmap-level summary.*

### M21 — List ↔ Detail Context Preservation
Resolves `USABILITY_BACKLOG.md` items 2 & 6: one explicit rule (Sheet/drawer by default; a routed page only when a record's detail view needs its own shareable deep link — Purchase Orders and now Loans are the two legitimate routed-page cases, since both are linked from exports), then migrate Cases/Labs/Patients to match. **Dependencies:** benefits from M18/M20 as more reference examples. **Complexity:** Medium.

### M22 — Multi-Select, Staged
Stage 1: checkbox selection + Shift-click range + Ctrl/Cmd toggle (cheap, covers most of the value). Stage 2: drag/rubber-band visual selection + auto-scroll-while-dragging + right-click context menu (the fuller desktop-grade polish). **Dependencies:** benefits from Phase 4 existing so there's a genuine bulk-actionable target (bulk-cancel draft POs, bulk-mark loans returned). **Complexity:** Medium (stage 1) / Large (stage 2).

### M23 — Keyboard Shortcuts + Command Palette Actions
One shortcut-registration layer (replacing today's one-off `⌘K` `addEventListener` in `AppLayout.tsx`); extend the command palette to run actions ("New Loan", "New Purchase Order"), not just find records. **Dependencies:** none blocking; more valuable once more workflows exist to have shortcuts for. **Complexity:** Medium.

---

## Phase 6 — Scoped, Workflow-Integral Editing
*Replaces the original plan's M11 (a blanket Edit/Delete sweep across every entity). Most of that milestone's real value turned out to be narrower: specific workflows feeling incomplete, not a general desire to CRUD every table.*

### M24 — Workflow-Integral Editing & Narrow, Gated Delete
- **Objective:** Only the edits that complete a workflow — e.g. editing a Draft PO's vendor/lines before submitting (today you can only cancel and recreate), editing an open Loan before it's returned, correcting a Patient/Vendor contact detail. Delete stays Super Admin-gated (per the Users page's documented Role Permissions matrix) and scoped narrowly (e.g. removing a duplicate Draft PO created by mistake) — audit-trail-bearing entities (movements, a submitted PO, a Sale) should generally **not** be deletable at all, consistent with `PROJECT.md` principle 2 ("every stock movement must be traceable").
- **Files affected:** Per-workflow, small — extends the detail pages/dialogs Phase 4 builds (Product, Loan, PO) rather than a uniform sweep.
- **Risks:** Medium — this is the first place the Role Permissions matrix (currently pure documentation) becomes real, load-bearing logic; decide the `can(action, role)` shape carefully once, here, since real auth (Phase 9/M14) will later replace *how* the role is known, not *how* it's checked.
- **Dependencies:** Benefits from Phase 4's detail pages existing to build the edit affordance into.
- **Estimated complexity:** Medium, spread across several small module-specific edits rather than one large uniform feature.

---

## Phase 7 — Modular Advanced Features

### M25 — Barcode System: Modes, Formats & Dynamic Generation
- **Objective:** Make barcode/QR support an optional, clinic-configurable module instead of an always-on feature. **These are permanent product rules, locked in 2026-07-27** — see `PROJECT.md` §3 (Barcode/QR) and principle 10 for the canonical statement; this entry is the implementation plan for them, not a re-derivation.

  **The rules, verbatim in intent:**
  1. Every product always receives a permanent internal Product ID at creation, regardless of barcode settings — it exists silently even when barcode support is Disabled.
  2. `ClinicSettings.barcodeMode: 'disabled' | 'display-only' | 'full-workflow'`, default `'disabled'`:
     - **Disabled** — no barcode/QR shown anywhere, no scan buttons, no print-label option, no barcode-related workflow at all.
     - **Display Only** — barcode/QR generated on demand from the Product ID; view/print/export labels; no scanning workflow.
     - **Full Workflow** — everything in Display Only, plus scanning becomes available in stock receiving, inventory lookup, and future movement workflows.
  3. `ClinicSettings.barcodeFormat: 'QR' | 'CODE128' | 'EAN13'` (QR is the recommended default) — configurable independently of `barcodeMode`, only shown when mode ≠ disabled, kept out of normal users' way (e.g. behind an "Advanced" disclosure) unless needed.
  4. No barcode/QR values are stored. The permanent Product ID is the only source of truth; the barcode/QR image is generated dynamically, every time it's displayed or printed, from the Product ID + the clinic's current format setting. This is what makes enabling/disabling/reformatting retroactive with **zero migration** — nothing about an existing product needs to change.

  **Data model change this requires:** add `Product.productId: string` — a permanent, sequential, all-numeric identifier assigned at creation (reusing today's `890${pad(2000000+seq,9)}`-style generation from `addProduct`, already numeric and already verified EAN-13-compatible during M13), distinct from the internal `Product.id` (an opaque `prd_xxx` key never shown to users). This mirrors the existing pattern for Patient (`patientCode`), Case (`caseId`), Loan (`loanNumber`), Sale (`saleNumber`), PO (`poNumber`) — Products is currently the one entity without a permanent human-facing code separate from the manufacturer-derived `sku`. Remove `Product.barcode`/`Product.qrPayload` as *stored* fields — replace with pure functions (`barcodeValueFor(product, format)`, `qrPayloadFor(product)`) computed at render time.

- **Files affected:** `src/types/index.ts` (`Product`, `ClinicSettings`), `src/store/DataContext.tsx` (`addProduct` generates `productId`, not `barcode`/`qrPayload`), `src/mocks/products.ts` + `src/mocks/settings.ts` (seed defaults: `barcodeMode: 'disabled'`, `barcodeFormat: 'QR'`), `src/components/shared/Barcode.tsx` (derive from `productId` + format), `src/components/products/ProductDetailSheet.tsx` (mode-gated: hidden entirely when disabled; a single code matching the selected format when enabled — not barcode-and-QR-always-both, as today), `src/pages/settings/SettingsPage.tsx` (mode selector; format selector shown/enabled only when mode ≠ disabled), plus the Full Workflow scan entry points (`POReceiveDialog`, inventory lookup / `GlobalSearch`) — likely large enough to warrant its own follow-up sub-milestone once scoped.
- **Risks:** Medium for the mode/format/data-model work (touches every barcode-reading call site — needs the same greppable-completion discipline as Phase 2's M3). The scanning half of Full Workflow needs a real product decision first (camera-based scanning vs. hardware-scanner keystroke-wedge capture, which decode library) — don't estimate that blind; scope it as a named follow-up once Display Only mode is solid.
- **Dependencies:** None blocking — self-contained. Sequenced in Phase 7 (after core workflows) per principle 9, since this is a configurability feature, not a workflow-completeness gap. Complements, but is distinct from, the original plan's M16 (real GS1-compliant barcodes once a real backend/product-master exists) — M25 builds the mode/architecture now, client-only; M16 later swaps in true scan-standard compliance.
- **Estimated complexity:** Medium (data model + mode-gated Display Only) + Large (Full Workflow scanning, once scoped as its own piece).

---

## Deferred Infrastructure & Backend Work
*Not abandoned — resequenced. Nothing here has user-facing value until a real backend is actually in scope, except M10, which is cheap enough to do opportunistically any time (see `PROJECT.md` §2, principle 9's exception).*

### Phase 8 — Architecture Evolution (deferred)
- **M7 — Services Layer Behind `DataContext`.** Extract `DataContext`'s action bodies into `src/services/*`, one file per domain, same signatures — a pure seam, no behavior change. **Complexity:** Large.
- **M8 — Split/Slice `DataContext` for Render Scalability.** Per-domain contexts so a state change doesn't re-render every `useData()` consumer. **Dependencies:** M7. **Complexity:** Large.
- **M9 — Route-Level Code-Splitting.** `React.lazy()` per route to shrink the ~1.3MB single chunk. **Complexity:** Small.
- **M10 — Error Boundaries & Resilience.** A top-level `ErrorBoundary` so a render failure degrades to a recoverable screen instead of a blank one — directly relevant after the patient-DOB crash found in Phase 2. **Do this opportunistically, any time** — it's cheap and protects the workflows Phase 4-7 are building, it doesn't need to wait for the rest of Phase 8. **Complexity:** Small.

### Phase 9 — Real Backend / MVP Cutover (deferred, unchanged from original plan)
- **M14 — Authentication & Session-Enforced Permissions.** Real login/session, replacing hardcoded `currentUser`. **Dependencies:** M24 (permission-checking API already exists and is in use). **Complexity:** X-Large.
- **M15 — Backend & Persistence Integration.** Real backend/database behind `src/services/*`. **Dependencies:** M7, M8, M14. **Complexity:** X-Large.
- **M16 — Real Scannable Barcodes & Audit Export.** GS1-compliant barcodes tied to a real product master (distinct from M25's client-side mode system — see M25's dependencies note) + CSV/PDF export of the Stock Movement log. **Dependencies:** M15. **Complexity:** Medium.

---

## Summary Table (active roadmap)

| # | Milestone | Phase | Complexity | Hard Dependencies |
|---|---|---|---|---|
| M17 | Sticky List-Page Toolbar | 4 | S | — |
| M18 | Loans → Production-Ready Workflow | 4 | M | — |
| M19 | Batch/Lot Traceability Screen | 4 | M | — |
| M20 | Sales Receipt/Share Polish | 4 | S | — |
| M21 | List↔Detail Context Preservation | 5 | M | benefits from M18/M20 |
| M22 | Multi-Select, Staged | 5 | M/L | benefits from Phase 4 |
| M23 | Keyboard Shortcuts + Command Actions | 5 | M | — |
| M24 | Workflow-Integral Editing & Narrow Delete | 6 | M | benefits from Phase 4 |
| M25 | Barcode System: Modes/Formats/Dynamic Gen | 7 | M+L | — |

*(Deferred: M7–M10 (Phase 8), M14–M16 (Phase 9) — see appendix above.)*

**Recommended immediate next step:** M17 (sticky toolbar) as a same-day, universal win, then M18 (Loans) as the first substantial piece of Phase 4 — mirroring Phase 3's proven Purchase Order pattern.
