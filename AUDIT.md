# AUDIT.md — ImplantDesk Production-Readiness Audit

> Conducted 2026-07-27 by direct codebase verification (four parallel research passes, each citing file:line evidence — nothing here is assumed). Scope: all 14 modules, plus 34 specifically-requested checks, plus a Documents-capability strategy. This document is the evidence base for the reordered roadmap in `DEVELOPMENT_PLAN.md`.

---

## Executive summary — the 5 most consequential findings

Ranked by how much they threaten the product's own stated principles (`PROJECT.md` §2), not by effort:

1. **Case status is permanently frozen after creation, and implants can never be attached to a case post-creation.** `DataContext` has no `updateCase` function of any kind — `CaseFormDialog` only sets status once at creation, and there is zero UI anywhere to advance `planning → surgery-scheduled → in-progress → restoration → completed`. This directly contradicts `PROJECT.md` §3's own claim that "each status transition is reflected as a Timeline event." For a *case-tracking* system, this is the single biggest gap between spec and reality.
2. **No stock-availability check on Sales or Loan issuance.** `createSale` and `createLoan` will happily deduct more stock than exists — `applyQtyDelta` floors at `Math.max(0, ...)` (`DataContext.tsx:133-135`), silently clamping to zero with no warning. This is a real correctness hole against principle 1 ("inventory accuracy is more important than speed"), not a missing convenience.
3. **`quantityReserved` (Reserved Stock) is entirely decorative.** Displayed as a real concept, never written to by any action. The "allocated to a case but not yet used" business rule documented in `PROJECT.md` §3 does not exist in the running app.
4. **No Batch/Lot management screen, and no batch-lot capture on Sales.** The `ProductBatch` type exists and is never constructed anywhere; `SaleFormDialog` never collects a lot number even though `SaleLine.batchLot` exists in the schema. For implant fixtures and graft material, this is a real recall/traceability gap.
5. **Vendors, Sales, and Loans have no detail view at all** — no routes, no clickable rows/cards. This breaks the "no click wasted" / "preserve context" standard the other 9 modules (Products, Patients, Cases, Labs, POs) already meet correctly, and it's the most visible source of the app currently feeling unevenly finished.

Two additional cross-cutting gaps worth flagging at the top because they're cheap and protect everything else:
- **Zero `ErrorBoundary` anywhere in the app** — any unexpected render-phase exception blanks the whole screen with no recovery UI.
- **Zero import/export/print/PDF capability exists beyond one Purchase Order** (`window.print` + a disabled "coming soon" PDF stub, both on `PODetailPage` only). None of the 8 named documents (Invoice, Proforma, Challan, Receipt, PO PDF, GRN, Loan slips) exist anywhere in the codebase under any name — confirmed by exhaustive grep, not assumed absent.

---

## Module-by-module checklist

Legend: ✅ Implemented & solid · 🟡 Partial (real functional gap) · ❌ Missing entirely · 🎨 UI/UX issue · 🔧 Technical debt · 📋 Business workflow gap

### Dashboard
- ✅ All 6 stat cards computed live, each deep-links to its source page. 14-day movement chart, value-by-manufacturer chart, Recent Activity/Low Stock/Outstanding Loans panels all read live `DataContext` state.
- ❌ No date-range picker — 14d/30d windows are hardcoded.
- 🎨 Recent Activity / Low Stock / Outstanding Loans empty states are hand-rolled `<p>` text instead of the shared `EmptyState` component (`DashboardPage.tsx:187,208,230`) — the one place in the app that diverges from the otherwise-consistent empty-state pattern.

### Products
- ✅ Create flow (zod + react-hook-form), auto-generated SKU/barcode/QR, card/table dual view with sortable table, `ProductDetailSheet` with identifiers, recent movements, working inline stock adjuster (reason-validated).
- 🟡 `quantityReserved` displayed but never mutated by any action (see Executive Summary #3).
- ❌ No edit (`updateProduct` exists in `DataContext` but is **dead code** — zero callers anywhere in `src/`), no delete/discontinue toggle, no bulk import/export.
- 📋 No reorder-point automation despite `lowStockThreshold` existing on every product.

### Inventory
- ✅ Filterable/searchable movement log (All/Inbound/Outbound/Adjustment), stat tiles, `AdjustmentDialog` blocks empty reasons.
- 🟡 Table hard-capped to first 100 rows client-side (`InventoryPage.tsx:129`) with **no pagination** — silently truncates on a larger dataset.
- ❌ No CSV/PDF audit-trail export.

### Purchase Orders — the most mature module
- ✅ Full `draft → submitted → confirmed → partially/fully-received` lifecycle with one shared legality source (`poWorkflow.ts`), line-by-line partial receiving, append-only audit history, WhatsApp-copy + print + photo-attachment all genuinely working.
- 🟡 "Generate PDF" present but honestly disabled ("coming soon") — not a hidden gap.
- 📋 No multi-vendor price comparison for the same product.

### Vendors
- ✅ Create flow, search, on-time-rate/manufacturer badges.
- ❌ **No Vendor Detail page or route exists.** Cards have no `onClick` at all — a vendor's own PO history, supplied products, and performance are nowhere viewable beyond two counters on the card. Directly violates `PROJECT.md` §2 principle 11 / §2a.

### Patients
- ✅ Create flow, full profile page (linked Cases + Sales History — correctly implements "preserve context"), clickable rows.
- ❌ No edit, no merge/duplicate detection, no document/consent-form attachment.

### Cases
- ✅ Create flow (patient/doctor/lab/procedure), list filters (status/doctor/lab), detail page (Timeline + Implants Used + linked Patient/Lab).
- ❌ **No case status transition mechanism exists anywhere** (Executive Summary #1). No `updateCase`/`updateCaseStatus` in `DataContext`. Status is permanently frozen after creation.
- ❌ **No way to add implants to a case after creation** — `addCase` defaults `implants: []`; `createSale` never writes back to `Case.implants`. "Implants Used" is permanently empty for every UI-created case.
- 🔧 Because the Timeline is static mock data (`caseTimelines`) with a generic one-event fallback, a UI-created case's Timeline never grows past "Case Opened" regardless of what happens to it (this is the same root-cause pattern already fixed for Purchase Orders in Phase 3 — Cases needs the same live-history treatment).
- 📋 **New finding (found 2026-07-28, while scoping P1-E — not part of the original 2026-07-27 audit passes):** `addImplantToCase` (shipped in P1-A) never calls `addMovement` and never deducts `quantityOnHand` — recording that an implant was used in a case has zero effect on stock or the audit trail today. `createSale` (with a `caseId`) is the only code path that actually moves inventory for a case-linked component. This means a lot referenced only via `CaseImplantUsage.batchLot` (not also sold) shows up in P1-E's Batch/Lot traceability view purely as an informational usage record — it is deliberately excluded from that view's remaining-quantity arithmetic, since no stock was actually moved. Flagged here per its own scoping note; not fixed as part of P1-E — deserves its own milestone.

### Labs
- ✅ Create flow, clickable cards → detail page, contact info + full Loan History list.
- 🟡 "Cases Involving Lab" stat card shows a count but never lists the cases (unlike the Loan History card, which does) — inert stat, no drill-down.

### Sales
- ✅ Create flow correctly deducts stock and writes a `sale` movement.
- ❌ **No Sale Detail page/route** — rows aren't clickable; a sale with >2 lines only shows a "+N more" badge with no way to see the rest.
- ❌ No `batchLot` field on the sale-line form despite `SaleLine.batchLot` existing in the schema — a batch-tracked product sold through the UI can never record which lot was dispensed.
- 📋 No stock-availability check (Executive Summary #2).

### Loans
- ✅ Loans-to-labs-only enforced, correct status derivation, lost-reason required, immediate stock deduction on issue.
- ❌ **No Loan Detail page/route** — rows have no click handler at all (only the "Process Return" button is interactive).
- 📋 Same oversell issue as Sales — the product dropdown shows stock counts but doesn't block loaning more than `quantityOnHand`.

### Loan Returns
- ✅ Correctly derives a read-only log purely from `movements` (guaranteed can't drift, exactly as `PROJECT.md` §3 specifies). No gaps found relative to spec.

### Reports
- ✅ 4 tabs (Inventory/Sales/Loans/Purchases), each with stat cards + one chart.
- ❌ No export of any kind on any tab.
- ❌ No dedicated Batch/Lot report, no Expiry report, no Doctor-wise report.
- 🟡 A Stock Valuation view exists but only as a by-category chart, not a per-SKU table. A Manufacturer-wise breakdown exists, but on the **Dashboard**, not here — inconsistent home for a "report."
- 🔧 The 4 top-level stats (`inventoryValue`, `totalRevenue`, `totalPOSpend`, `lostUnits`) are computed unmemoized in the render body while the chart data immediately above them is memoized — inconsistent within the same file (low real-world impact at current data volume, still worth fixing alongside other Reports work).

### Users
- ✅ Create flow, Role Permissions matrix table.
- ❌ No edit (change role/deactivate), no delete. Confirmed the matrix is **100% documentation** — zero code anywhere checks a role before allowing an action (`currentUser.role`/`superAdmin` grep: zero matches outside the matrix data itself).

### Settings
- ✅ Clinic info, price-visibility default, barcode format selector, theme switcher, all wired through `updateClinicSettings`.
- ❌ Confirms `ClinicSettings` has no `barcodeMode` field yet — the Disabled/Display-Only/Full-Workflow system is genuinely not built (correctly documented as planned, Phase 7/M25).

---

## The 34-item verification checklist

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Import/Export | ❌ Missing | No `papaparse`/`xlsx`/`file-saver` in `package.json`; zero export/import buttons on any of the 11 list pages; zero `Blob`/`createObjectURL` usage anywhere. |
| 2 | Print | 🟡 Partial | `window.print` exists in exactly one place, `PODetailPage.tsx:47`. No `@media print` stylesheet anywhere. |
| 3 | PDF generation | ❌ Missing | No `jspdf`/`pdf-lib`/`react-pdf`/`html2canvas` anywhere. Only a disabled stub button (`PODetailPage.tsx:218-222`). |
| 4 | Barcode/QR label printing | ❌ Missing | Single-item display only (`ProductDetailSheet.tsx`); no print trigger, no bulk/label-sheet flow, no "print labels" string anywhere in the codebase. |
| 5 | Sales Invoice | ❌ Missing | Zero matches for "invoice" anywhere in `src/`. |
| 6 | Proforma Invoice | ❌ Missing | Zero matches for "proforma". No Quote/Estimate entity exists to generate one from. |
| 7 | Delivery Challan | ❌ Missing | Zero matches for "challan". |
| 8 | Payment Receipt | ❌ Missing | Zero matches. No payment-tracking data at all — `Sale` has a `total`, no `amountPaid`/method/balance. |
| 9 | Purchase Order PDF | 🟡 Partial | Disabled stub only (see #3). |
| 10 | GRN | ❌ Missing | Zero matches for "GRN" (case-insensitive). The underlying data (per-line receiving events) already exists in PO history — this is a rendering gap, not a data gap. |
| 11 | Loan Out Slip | ❌ Missing | Zero matches; no Loan Detail page to generate one from yet. |
| 12 | Loan Return Receipt | ❌ Missing | Zero matches. |
| 13 | Audit Trail export | ❌ Missing | No export button on `InventoryPage`. |
| 14 | Stock Valuation reports | 🟡 Partial | Exists only as a by-category chart (`ReportsPage.tsx`), no per-SKU table. |
| 15 | Batch/Lot reports | ❌ Missing | No aggregate view anywhere; `ProductBatch` type unused. |
| 16 | Expiry reports | ❌ Missing | `Product.expiryDate` field exists in the type but is **dead schema** — never set in mocks, never in any form, never rendered, never reported. |
| 17 | Doctor-wise reports | ❌ Missing | `doctor`/`primaryDoctor` are filter fields on Cases/Patients, never aggregated into a report. |
| 18 | Manufacturer-wise reports | 🟡 Partial | Exists, but on the Dashboard, not Reports — inconsistent home. |
| 19 | Responsive/mobile experience | 🟡 Partial | Navigation chrome (sidebar/topbar) is genuinely mobile-ready with a working hamburger+drawer. Tables have **zero** responsive column-hiding or card fallback — horizontal scroll only, on every list page. |
| 20 | Sticky page headers | ❌ Missing | `PageHeader` itself is not sticky anywhere (only the M17 toolbar row is, on 10 pages). |
| 21 | Sticky table headers | ❌ Missing (inert) | `TableHeader` already has `sticky top-0` CSS but it's inert — its wrapper's `overflow-auto` creates a nested scroll context that never overflows, since the real scroll happens at `<main>`, one level up. Needs a primitive fix, not a per-page patch. |
| 22 | Every clickable element does something | 🟡 Partial | True for Products, Purchase Orders, Patients, Cases, Labs. False for Vendors, Sales, Loans, Loan Returns, Inventory, Users (rows/cards render but have no `onClick`). |
| 23 | Multi-selection behavior | ❌ Missing | No selection state, no checkboxes, no drag-select anywhere. Confirmed the reported bug: dragging across cards has no selection handling at all, so the browser's native text-selection is the only thing that fires. |
| 24 | Bulk actions | ❌ Missing | Depends on #23, which doesn't exist. |
| 25 | Detail pages for every major entity | 🟡 Partial | 5 of 8 named entities (Product, Patient, Case, Lab, PO) have one; Vendor, Sale, Loan do not. |
| 26 | Keyboard shortcuts | 🟡 Partial | Only `⌘K`/`Ctrl+K` global search exists, implemented as a one-off `addEventListener` in `AppLayout.tsx`, not a registered shortcut layer. |
| 27 | Accessibility | ✅ Good | Every sampled icon-only button has `aria-label`; focus-visible rings present and consistent; `StatusBadge` always pairs color with a text label (enforced by its exhaustive type, not just convention). |
| 28 | Empty states | 🟡 Inconsistent | 14 of 16 pages use the shared `EmptyState` correctly. Dashboard widgets hand-roll their own text; Users and Reports have no empty-state handling at all. |
| 29 | Loading states | ✅ Good | Every one of the 14 `simulateLatency` call sites is correctly paired with a `submitting` state wired into `Button`'s `loading` prop. No gaps found. |
| 30 | Error handling | ❌ Missing | Zero `ErrorBoundary` anywhere. `DataContext` throws from 12+ call sites, none guarded by a caller `try/catch` — currently only reachable if UI-level guards and `DataContext` rules drift apart, but there is zero containment if they do (and no `finally`, so a submit button could get stuck in a spinner state forever in that scenario). |
| 31 | Search quality | 🟡 Partial | Every list-page search is a plain case-insensitive substring match, computed synchronously and un-debounced (fine at current data volume, a real concern at scale). `⌘K` only searches 4 of ~10 searchable entities (Products/Patients/Cases/Labs — not Vendors, Sales, Loans, POs, Users). Its "barcode lookup" hint is a dead, disabled placeholder. |
| 32 | Filter consistency | 🟡 Inconsistent | Where filters exist they follow a consistent `value="all"` sentinel convention. But filter *depth* varies with no stated rule — Cases/Loans get 2-3 dropdown filters, Vendors/Patients/Labs/Sales get search-only despite having equally filterable fields. Inventory uses Tabs for its type filter while every other page uses a Select dropdown for the equivalent case. |
| 33 | Performance concerns | 🟡 Minor | Filtering is consistently memoized per-page. The real concern is architectural: one monolithic `DataContext` means any single mutation (e.g. one stock adjustment) re-renders every component consuming `useData()` app-wide, regardless of relevance — invisible at current mock-data volume (dozens to ~150 records per entity), but this is exactly the kind of thing that's cheap to fix now and expensive to fix later. |
| 34 | Duplicate/inconsistent UI components | 🟡 Minor | Ten list pages hand-roll a boxed-container `<div>` instead of using the `Card` component (consistent enough across pages to read as a deliberate lighter idiom, but it is a second competing "container" pattern). Tooltips and status-badges are used consistently everywhere — no real duplication found there. |

---

## Documents capability — recommended architecture

**Recommendation: no separate "Documents" module or page.** Every document type listed has a natural source record it belongs to, and generating it from that record (rather than a standalone document-picker screen) is both less UI to build and a better match for how a clinic actually works — nobody thinks "let me go generate a GRN," they think "let me finish receiving this PO."

| Document | Generated from | Status of the underlying data |
|---|---|---|
| Purchase Order PDF | PO Detail page | Ready — `poShare.ts`'s `buildPOSummaryText` already assembles the content; needs a real renderer, not new data. |
| Goods Received Note (GRN) | A PO's receiving event (PO Detail → History) | Ready — each receipt is already a discrete, append-only history entry with quantities and a timestamp. |
| Sales Invoice | Sale Detail page *(needs to be built — Priority 1/2)* | Ready once the detail page exists — `Sale`/`SaleLine` already carry everything an invoice needs except tax handling (out of scope per `PROJECT.md` §9's "no real financial rules"). |
| Delivery Challan | Sale Detail *or* Loan Detail (goods leaving the clinic either way) | Ready once those detail pages exist. |
| Loan Out Slip | Loan Detail page *(needs to be built)* | Ready once it exists. |
| Loan Return Receipt | A loan's return event (Loan Detail → History, once Loans gets the same audit-history treatment POs have) | Needs Loans' audit-history milestone first. |
| Barcode/QR Labels | Products list (single, already works) *and* a bulk "select products → print label sheet" flow | The bulk case is a genuine, concrete use for the multi-selection system — a real payoff for that investment, not a hypothetical one. |
| Stock Reports / Sales Reports | Reports page, per tab | Ready — needs an export affordance added to existing charts/tables. |
| **Proforma Invoice** | *(open question)* | **No natural source exists** — there's no Quote/Estimate concept in the data model. Recommend modeling it as a Sale in a not-yet-finalized state rather than building a whole new entity, but this needs a product decision before implementation (see Open Decisions below). |
| **Payment Receipt** | *(open question)* | **No payment data exists at all** — `Sale.total` is not the same thing as "amount actually paid." A real receipt needs at minimum `amountPaid`/payment method/outstanding balance added to the data model first. This is a data-model milestone, not just a document template. |

**Shared technical foundation (build once):**
- **PDF generation approach:** recommend starting with the browser's native print-to-PDF (extending the `window.print()` + `@media print` pattern already proven on Purchase Orders) rather than adding a PDF library. Zero new dependencies, reuses a pattern that already works. Fall back to a real library (`@react-pdf/renderer` fits best given this is already a React codebase) only if print-to-PDF proves insufficient for something with strict layout needs, like a label sheet aligned to real label-paper dimensions.
- **Excel/CSV export:** recommend plain CSV via a small `exportToCsv(rows, filename)` utility (Blob + `createObjectURL`, no library) rather than a full `xlsx` dependency — Excel opens CSV natively, and nothing requested here needs multi-sheet workbooks or formulas.
- **One shared document-rendering layer** (`src/lib/documents/` or similar): a per-document-type presentational component (`InvoiceDocument`, `GRNDocument`, etc.), each consuming a plain data object built by a small `build<X>Data()` function — generalizing the `poShare.ts` pattern that already exists, not inventing a new one.

---

## Open product decisions (need your call before or during implementation)

1. **Case status/implant editing** — add a scoped `advanceCaseStatus` + `addImplantToCase` pair (recommended, matches the "workflow-integral editing, not blanket CRUD" principle already established), or a general `updateCase`?
2. **Stock-availability enforcement** — should overselling on a Sale/Loan be a hard block (recommended — matches "inventory accuracy over speed"), or a soft warning the user can override?
3. **Proforma Invoice** — model as a special Sale state (recommended, avoids a new entity), or build a real Quote/Estimate entity?
4. **Payment Receipt** — needs new fields on `Sale` (`amountPaid`, method, balance) at minimum. Confirm this scope before it's folded into a milestone.
5. **Import** — recommend scoping separately from Export (real data-integrity risk: SKU/barcode collisions, validation) rather than bundling them into one milestone.
6. **`quantityReserved`** (decorative) and **`Product.expiryDate`** (dead field) — wire these up now as part of the Batch/Lot and Case-fix work, or explicitly defer them further?

See `DEVELOPMENT_PLAN.md` for how all of the above is sequenced into milestones.
