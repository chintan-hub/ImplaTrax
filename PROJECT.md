# PROJECT.md — ImplaTrax

> This document is the single source of truth for anyone (human or AI) picking up this project cold. Read this before reading any code. If something in the code contradicts this document, treat that as a bug to fix — either the code drifted, or this document is stale and needs updating in the same change.

---

## 1. Project Overview

**ImplaTrax** is a high-fidelity, click-through **prototype** of a Dental Implant Inventory Management System.

- **What it is not**: a Practice Management System, an eCommerce platform, or a generic warehouse inventory tool.
- **What it is**: a purpose-built inventory and case-tracking system for **dental implant clinics and dental laboratories**, covering the full lifecycle of an implant component — purchase, storage, loan to a lab, use in a patient case, or sale.

**Who it's built for:**
- Dental implant clinics that stock physical implant components (fixtures, abutments, screws, graft material, etc.) and need to track exactly where every unit is.
- Dental laboratories that receive components on loan from clinics (for try-in, custom work, fabrication) and are expected to return or account for them.
- Non-technical staff — dentists, dental assistants, front-desk staff — who have no formal software training.

**Primary goals:**
1. Demonstrate a complete, realistic UI/UX for every core workflow (see [Business Rules](#3-business-rules)) using believable mock data — no backend required to evaluate the product.
2. Prove out a design system and interaction language (Linear/Notion/Stripe-inspired: fast, minimal, professional) that a future production build can adopt directly.
3. Prove out a **self-teaching UI** — see [Core Philosophy](#2-core-philosophy) — so the product needs minimal onboarding/training.

**Current project status:** Feature-complete interactive prototype, no backend. All 14 modules exist, are routed, and are wired to a shared in-memory data store so actions in one place (e.g. receiving a Purchase Order) are reflected everywhere else live (Dashboard stats, Inventory history, Product stock). A UX polish pass (tooltips, empty states, microcopy, terminology consistency, accessibility) has been applied on top of the functional build. See [§12 Session Handoff](#12-session-handoff-where-we-currently-are) for exact state.

---

## 2. Core Philosophy

These are the non-negotiable principles behind every design and implementation decision in this codebase. When two approaches are both technically valid, pick the one that best serves these:

1. **Inventory accuracy is more important than speed.** Every action that changes stock (purchase receipt, sale, loan, loan return, manual adjustment) must go through a code path that also writes a Stock Movement record. There is no "fast path" that mutates `quantityOnHand` without a paired movement — see `src/store/DataContext.tsx`, where every mutating action pairs a state update with `addMovement(...)`.
2. **Every stock movement must be traceable.** A movement always has a `reason` and a `performedBy`, and usually a `reference` (PO number, Loan number, Sale number, Case ID). Nothing silently changes stock.
3. **The software should teach itself through the interface.** A first-time dental assistant should understand a page, button, or term without reading a manual. This is why the centralized help-text system (`src/content/helpText.ts`) exists — see [§6 Component Library](#6-component-library) and [§8 Terminology](#8-terminology).
4. **Keep workflows simple for dentists and assistants.** Prefer one obvious primary action per screen. Avoid nested/modal-in-modal flows. Prefer inline forms and single-purpose dialogs over wizards.
5. **Business rules should never be bypassed**, except by a Super Admin role for destructive actions (e.g. deleting a record) — this permission boundary is documented in the Users → Role Permissions matrix (`src/pages/users/UsersPage.tsx`) and should be respected by any new feature.
6. **No hardcoded explanatory copy.** Every tooltip, term definition, microcopy hint, empty-state message, and page introduction lives in `src/content/helpText.ts`. A component never inlines this kind of text — it looks it up by key. This means the entire product's "voice" can be edited by changing one file.
7. **Terminology is fixed and consistent.** See [§8 Terminology](#8-terminology) for the canonical word list. A synonym for an existing term is a bug, not a stylistic choice.
8. **ImplaTrax must feel like professional desktop software, not a website.** The design goal is not "looking modern" — it's making every repetitive task effortless and extremely fast, for a user processing hundreds of records a day, not an occasional visitor. Every repeated workflow should get *faster* with experience. Concretely: minimize clicks, mouse movement, and scrolling; keep frequently used controls visible (sticky search/filter/action bars on long pages); preserve user context when navigating (scroll position, filters, selection — don't lose them going to a detail view and back, and preserve selections across edits where practical); support efficient bulk operations, including desktop-style multi-select (drag/rubber-band selection, click-and-drag continuous selection, auto-scroll while dragging, Shift-click range selection, Ctrl/Cmd multi-selection, right-click context menus) wherever it makes sense; prefer drawers, sheets, or inline editing over a full page transition where appropriate; treat keyboard shortcuts as first-class, not an afterthought. Prefer the interaction pattern a mature desktop application would use (Excel, File Explorer, Photoshop, AutoCAD, VS Code, Figma) over a generic web/CRUD pattern when one applies more naturally. This is a standing license to refactor previously-built UI for usability whenever you're working in that area — business logic, data integrity, and functionality must be unchanged, but the UI around them is always open to improvement. A local, low-risk friction fix should be made when it's found, not just noted. A larger change that needs to be consistent across many screens (e.g. a bulk-selection pattern, an app-wide keyboard-shortcut layer) gets a reusable component/infrastructure built once, tracked and prioritized in `USABILITY_BACKLOG.md` at the repo root, then adopted gradually everywhere it applies — never a one-off per screen.
9. **Business workflows and usability come before infrastructure work.** ImplaTrax's highest priority is being the fastest, most effortless inventory system to use every day — not the most elegantly layered codebase. When sequencing work, a gap in a real daily workflow (stock receiving, sales, loans, loan returns, traceability, and the like) or a friction point real users hit outweighs backend-shaped architecture work (a services layer, further state-management refactors, code-splitting) that has no user-facing effect yet. Infrastructure work is not abandoned — see `DEVELOPMENT_PLAN.md` — it's sequenced *after* the workflows and usability gaps it doesn't block. The one exception: infrastructure that's cheap and directly prevents a workflow from breaking (e.g. an error boundary) is worth doing opportunistically any time, since it protects the workflows this principle prioritizes.
10. **Advanced or optional functionality should be modular, not force every clinic into every feature.** Where a piece of functionality is genuinely optional for some clinics (not core to the traceability/inventory-accuracy principles above), design it as a configurable module with explicit modes rather than one fixed always-on behavior. Example: the Barcode System should support modes such as Disabled, Display Only, and Full Workflow (scanning-driven), so a clinic that doesn't scan barcodes isn't shown scanning UI, and one that does isn't missing it. This is a design lens for *new* optional features, not a mandate to retrofit every existing feature into a mode system.
11. **No click should ever feel wasted.** Every clickable card, row, list item, or element either opens a detail view, expands with more information, reveals quick actions, or advances the next logical step — never nothing. Prefer preserving context with drawers, side panels, or expandable sections over an unnecessary full page change. See §2a below for the full, permanent UX Interaction Standard this principle (and principle 8) expand into.

### 2a. UX Interaction Standard (permanent, locked 2026-07-27)

This elaborates principles 8 and 11 into concrete, binding requirements — the level of detail below is intentional and permanent, not a one-off spec for a single milestone.

- **Sticky interface, everywhere.** Every major page has a sticky page header. The search/filter/sort toolbar stays pinned while scrolling. Table headers stay visible while scrolling. Card-based pages keep the page header and search/filter controls visible while content scrolls underneath. A bulk action bar stays pinned whenever one or more items are selected. Applies consistently across every list page: Products, Inventory, Purchase Orders, Vendors, Patients, Cases, Labs, Sales, Loans, Loan Returns, Reports, and Users (the last two get the sticky page header only — neither has a filter toolbar or a row-selectable table).
- **Bulk selection is a first-class, reusable, desktop-grade interaction system** — not a Products-only feature. Single click selects; Ctrl/Cmd+Click toggles; Shift+Click selects a range; click-and-drag draws a rubber-band selection rectangle; the view auto-scrolls while dragging near the top/bottom edge; dragging back over already-selected items updates the selection naturally; browser text selection is suppressed during an active drag-select. A sticky bulk action bar appears whenever the selection is non-empty.
- **Preserve context.** Opening a Product, Patient, Vendor, Purchase Order, Sale, Loan, Case, or Lab should let a user understand everything about it without hunting elsewhere in the app — its related history and next logical actions should be naturally exposed on that view, not require separate navigation to piece together.
- **Platform consistency.** The same interaction — search, filters, sticky headers, bulk selection, detail views, confirmation dialogs, keyboard interactions — behaves identically everywhere it appears. A pattern proven on one screen is a pattern owed to every other screen it applies to, not a one-off.

See `DEVELOPMENT_PLAN.md`'s Phase 5 for the concrete implementation strategy and milestone breakdown for this standard.

### 2b. Production Data Policy (permanent, locked 2026-07-28)

- ImplaTrax must ship with **no preloaded business data**. On first launch, Products, Doctors, Patients, Labs, Inventory (Stock Movements), Sales, Loans, Purchase Orders, and Batch/Lot records must all be empty — a new clinic starts with a genuinely blank system, not a demo dataset.
- **The only exception is minimum required system configuration** — e.g. a Super Admin account, or a first-time setup wizard that creates one. This is configuration, not business data.
- **Production builds must always start with an empty business database.** Mock/demo data exists solely to support development and automated testing and must never be loaded into production under any circumstance.
- **An empty system is the expected first-day experience for every new clinic, not an edge case.**
- Every future feature — including dashboards, reports, batch/lot management, search, and analytics — must gracefully handle an empty dataset without errors, placeholders that assume data exists, or dependence on seeded records. Developers may use mock/demo data during development, but production functionality must never depend on its existence. **Build every feature as if the system might be completely empty.**
- This principle doesn't dictate *how* mock data gets stripped or gated (dev-only build flag, environment check, separate seed script, etc.) — that's an implementation decision for whichever milestone does the work. It only locks the outcome.

---

## 3. Business Rules

These rules are currently implemented in code (mock data generators, `DataContext` actions, and page components) and must not be silently changed. If a rule needs to change, update it here first, then in code, in the same change.

### Inventory
- Every product has a `quantityOnHand` and a `quantityReserved`. Reserved stock is allocated to a patient case but not yet used/sold. **`quantityReserved` remains a placeholder (locked 2026-07-29, P1-N): nothing writes to it yet** — it is only ever set at product creation (0 via the real form) and displayed, never mutated by any action. **Available Stock** (`quantityOnHand - quantityReserved`, `src/lib/stock.ts`) is a real, honest calculation from these two existing fields — it is not itself a placeholder, even though one of its inputs currently never changes.
- Every product has a `lowStockThreshold` (a.k.a. "Minimum Stock"/"Reorder Level" in the UI). When `quantityOnHand <= lowStockThreshold`, the product's **Stock Status** (`src/lib/stock.ts`) is **Low Stock**; at `quantityOnHand === 0` it is **Out of Stock**; otherwise **Normal**. Flagged everywhere it appears (Dashboard, Products, the Topbar notification bell).
- **Page responsibilities (locked 2026-07-29, P1-N):** Products = one row per product, the product-level stock dashboard (Current/Available/Reserved/Reorder Level/Status). Inventory History (`/inventory`) = one row per movement, the append-only ledger — the source of truth for stock auditing. Product Details (`ProductDetailSheet`) = the complete per-product audit: current stock, categorized Purchase/Sales/Loan/Adjustment history, and Lot information when Batch/Lot Tracking is on. Movement records are never duplicated across these views — each reads the same underlying `movements`/`products` state.
- Manual stock adjustments **require a reason**. This is enforced in the UI (`AdjustmentDialog`, `ProductDetailSheet`) — the save action is blocked client-side if the reason field is empty, and the same validation exists in intent even though the mock `DataContext.adjustStock` itself does not re-validate (a real backend must validate server-side too).
- Batch/lot tracking is **optional per product** (`Product.batchTracked: boolean`). When enabled, the product supports a lot number on usage (`CaseImplantUsage.batchLot`, `SaleLine.batchLot`).
- Barcodes and QR codes are **always auto-generated** on product creation — the user never types or edits them (`DataContext.addProduct` generates `barcode` and `qrPayload` from a sequence).
- **Available Workflows (permanent, locked 2026-07-28 — not yet implemented, see `DEVELOPMENT_PLAN.md`):** every product must declare which workflow(s) it can be used in — a segmented control labeled "Available Workflows" with exactly three options: **Sale Only**, **Loan Only**, **Sale & Loan**. There is **no default selection** — choosing one is mandatory before a product can be created or saved, not a convenience the user can skip. It must remain editable later from product settings, since a clinic's workflow for a product can change. A short explanation directly under the control must describe in plain language how the selected option affects the product (e.g. whether it can appear when issuing a loan, recording a sale, or both). This is a genuinely new field and business rule — it does not exist in the codebase yet.

### Stock Movements (Audit History)
- Every action that changes stock produces one `InventoryMovement` record. Types: `inbound`, `outbound`, `adjustment`, `loan-out`, `loan-return`, `sale`, `lost` — `outbound` is a declared type with zero real producers (a dead enum member, excluded from Inventory History's Movement Type filter since it can never match anything).
- Movements are **append-only** — the mock store never edits or deletes a movement, it only ever adds new ones (see every action in `DataContext.tsx`).
- A movement's `quantity` is signed (positive = stock increase, negative = decrease), always has a `reason`, always has `performedBy` (the acting user), always has `quantityBefore`/`quantityAfter` (see "Inventory Movement Engine" below), has an optional `reference` (the PO/Loan/Sale number), and has whichever of `vendorId`/`labId`/`patientId`/`doctor`/`caseId` applies to its type.
- Inventory History (`/inventory`) is the canonical, filterable view of this history. The Product Detail sheet shows the same history split into per-product Purchase/Sales/Loan/Adjustment sections.

### Purchasing
- A Purchase Order (PO) is a record of components ordered from a **Vendor** before they arrive. Lifecycle: `draft → submitted → confirmed → partially-received / received`, or `cancelled` at any point before receipt.
- Receiving is **line-by-line and supports partial receipt** — a PO can be `partially-received` indefinitely; each receipt creates one `inbound` Stock Movement per line received and increases `quantityOnHand` immediately.
- A PO's status is derived from its lines' `quantityReceived` vs `quantityOrdered` — fully received lines across the board flips status to `received`.

### Loans (Labs only)
- **Loans can only be issued to Labs**, never to patients, vendors, or other clinics. This is a hard business rule enforced in the `LoanFormDialog` UI and should be enforced in any backend implementation too.
- A loan can contain **multiple products** (`Loan.lines: LoanLine[]`), each with its own loaned/returned/lost quantities.
- Loans **can stay open indefinitely** (months) — there is no auto-expiry. A `dueDate` is advisory only.
- Loan status is derived: `open` (nothing returned yet) → `partially-returned` (some but not all lines fully accounted for) → `closed` (every line's `quantityReturned + quantityLost >= quantityLoaned`).
- Issuing a loan immediately decreases stock (`loan-out` movement, negative quantity) — the component is treated as "out of the building" the moment it's issued, not when it's later confirmed lost or returned.

### Returns
- A Return records that a loaned component has been received back into inventory, **in full or in part**, against a specific loan line.
- Returning increases stock (`loan-return` movement, positive quantity).
- **Lost components reduce stock permanently** and require a reason (`lostReason`). A `lost` movement is negative and is never reversed — there is no "undo" on a loss, only a new adjustment if the item is later found (which would itself require its own reason).
- The Loan Returns page (`/loan-returns`) is a derived, read-only log — it is built by filtering the shared Stock Movement history for `loan-return` and `lost` types, not from a separate mutable table. This guarantees it can never drift from the movement history.

### Sales
- A Sale means a product has been **permanently used or sold** — it is not reversible from the Sales page (no "undo sale").
- A sale is usually, but not always, attached to a Patient Case (`Sale.caseId` is optional — direct/retail-style sales without a case are allowed).
- Recording a sale decreases stock (`sale` movement, negative quantity) and computes `total` from its line items.

### Patients
- One patient can have **multiple cases** (`Case.patientId` — one-to-many, no artificial cap).
- Patient records carry demographic + contact info and a `primaryDoctor` (the referring/treating clinician's name — a free-text field, distinct from the system's `AppUser` role of `clinician`, which is a login/permission role, not a patient-facing doctor identity).

### Cases
- Every case has a **human-readable Case ID** in the fixed format `IDC-YYYY-00001` — year of creation + a 5-digit sequence number that **resets at the start of each calendar year** (see `nextCaseId()` in `src/mocks/cases.ts` and the equivalent logic in `DataContext.addCase`). This ID is always auto-generated, never user-entered.
- A case has a `status` lifecycle: `planning → surgery-scheduled → in-progress → restoration → completed`, or `cancelled` at any point. Each status transition is reflected as a Timeline event on the Case Detail page.
- A case optionally references a **Lab** (`Case.labId`) — not every case involves outside lab work.
- A case tracks the specific implants used (`CaseImplantUsage[]`: product, tooth (FDI notation), quantity, optional batch lot).

### Labs
- A Lab is a **dental laboratory** — an external partner, not a clinic staff member or a vendor.
- Labs are the only valid recipient of a Loan (see Loans above).
- The Lab Detail page shows outstanding loan value, average turnaround, and every case that involved this lab.

### Vendors
- A Vendor is the **company a clinic buys implant components from** — never called "Supplier" anywhere in the UI (canonical term is "Vendor" — see [§8 Terminology](#8-terminology)).
- A Vendor is associated with one or more `Manufacturer` brands it distributes (Straumann, Nobel Biocare, Osstem, NeoBiotech, Dentium, MIS).
- Every Purchase Order belongs to exactly one Vendor.

### Permissions
- Four roles exist: `admin`, `clinician`, `inventory-manager`, `front-desk` (`UserRole` type). The Users page (`/users`) documents a permission matrix (view inventory, adjust stock/receive POs, issue/return loans, view pricing, manage patients/cases, manage users/settings) mapped against these four roles.
- **Destructive actions (e.g. permanent delete) are Super Admin only** — this is documented in the centralized icon-help registry (`ICON_HELP.delete`) even though no delete feature is currently wired into the UI (nothing in the prototype currently supports hard-deleting a record — this is an intentional scope boundary, see [§9 Current Limitations](#9-current-limitations)).
- There is no authentication in this prototype — `currentUser` is a hardcoded mock (`src/mocks/users.ts`) standing in for "whoever is logged in."

### Search
- **Global search** (⌘K / Ctrl+K, or the Topbar search bar) searches across Products (by name, SKU, or barcode), Patients (by name or patient code), Cases (by Case ID), and Labs (by name) simultaneously, grouped by type, and navigates directly to the matching record.
- **Advanced/contextual search**: each list page (Cases, Loans, Purchase Orders, etc.) additionally supports its own filter set — status, doctor, lab, date-relevant fields — as dedicated dropdown filters on that page, not folded into global search.

### Dashboard
- The Dashboard is the landing page (`/`) and surfaces, at a glance: Inventory Value, Low Stock Items count, Open Loans count, Pending Purchase Orders count, Cases This Month, and 30-day Revenue — each a clickable stat card that deep-links to the relevant page.
- It also charts Stock Movements (inbound vs. outbound, last 14 days) and Inventory Value by Manufacturer, and lists Recent Activity, Low Stock products, and Outstanding Loans.

### Barcode / QR

**Current implementation (pre-M25):** Every product's barcode (rendered via `jsbarcode`) and QR code (rendered via `qrcode`, payload format `IMPD:PRD:<id>`) are generated automatically at creation time, stored on the `Product` record (`barcode`, `qrPayload`), and displayed together under "Identifiers" on the Product Detail sheet — always on, no manual entry, no way to disable. Barcode format (CODE128 / CODE39 / EAN-13) is a clinic-wide setting (`ClinicSettings.barcodeFormat`) that controls how `BarcodeDisplay` renders (`src/components/shared/Barcode.tsx`); an invalid value for the selected format renders a blank barcode rather than throwing.

**Permanent product rules (locked in 2026-07-27; planned implementation is `DEVELOPMENT_PLAN.md` Phase 7 / M25 — not yet built, this is the target architecture the current implementation above will be migrated to):**
1. Every product always receives a permanent internal Product ID at creation, regardless of whether barcode functionality is enabled. This ID exists silently even when barcode support is Disabled.
2. Barcode functionality is controlled entirely by `ClinicSettings.barcodeMode`, one of three modes:
   - **Disabled** (the default) — the application behaves as if barcode support does not exist: no barcode/QR shown anywhere, no scan buttons, no print-label option, no barcode-related workflow. The permanent Product ID still exists in the background.
   - **Display Only** — barcode/QR can be generated from the Product ID whenever required; users can view, print, and export labels; no scanning workflow.
   - **Full Workflow** — everything in Display Only, plus barcode/QR scanning becomes available throughout relevant inventory workflows (stock receiving, inventory lookup, and future movement workflows).
3. Barcode **format** is configurable independently of barcode **mode** — `ClinicSettings.barcodeFormat`: QR Code (recommended default), Code 128, or EAN-13. These options are only shown when barcode mode is not Disabled, and stay out of normal users' way (e.g. behind an "Advanced" disclosure) unless needed.
4. Barcode/QR images are never stored. The permanent Product ID is the only source of truth; the barcode/QR is generated dynamically, every time it needs to be displayed or printed, from the Product ID plus the clinic's current format setting. **This means any clinic can enable barcode functionality at any time without migrating existing products or changing Product IDs** — nothing about a product needs to change when barcode mode is turned on, off, or reformatted.

This is also the reference example for principle 10 (§2) — optional/advanced functionality as a configurable module, not a one-size-fits-all always-on behavior.

### Batch/Lot Tracking

**Permanent product rule (locked 2026-07-28, implemented in P1-L):** Batch/Lot Tracking is a single, application-wide setting (`ClinicSettings.batchLotTrackingEnabled`) — **not a per-product setting** — with exactly two states, **OFF (default)** and **ON**, configured once in Settings:
1. **OFF** — the application behaves as though Batch/Lot Tracking does not exist: no Batch/Lot navigation, no Lot fields, no Lot validation, no Lot selection, no Batch/Lot pages, and no reference to Batch/Lot anywhere in the UI.
2. **ON** — Batch/Lot Tracking is fully integrated across every relevant workflow: Purchase Orders/Receiving, Sales, Loans, Returns, and Inventory History all show/enforce lot behavior. There is **never a partially-enabled state**. (Reports integration is pending — no Batch/Lot report exists yet at all, tracked separately in `DEVELOPMENT_PLAN.md` P1-I; whenever it's built, it must consume this same setting.)
3. Toggling this setting never deletes or migrates existing batch/lot data — only what the UI shows changes, matching this codebase's append-only, non-destructive philosophy (§2 principles 1–2).
4. `Product.batchTracked` survives as a secondary, per-product refinement underneath the global switch (confirmed 2026-07-28): which specific products carry lot numbers is still chosen per product, exactly as before — the global switch only gates whether the feature exists in the app at all. The per-product toggle on the Product form, and every badge showing it, are themselves hidden whenever the global switch is off.
5. **Exception, PO Receiving (locked 2026-07-29):** Batch/Lot capture at receipt is **not** gated by `Product.batchTracked`. When the global switch is ON, every received line on the PO Receive dialog captures a Lot/Batch number, regardless of whether the product is individually batch-tracked — traceability starts at the point stock enters the business, not at the point a specific product happens to opt in downstream. The Product form itself is unaffected by this rule: `batchTracked` still exists there unchanged, and still gates lot fields in Sales, Loans, and Cases exactly as described in point 4. Batch/Lot belongs to the inventory receipt event, not the product definition.

A dedicated Batch/Lot page (`/batches`) shows every recorded lot and its remaining quantity (built in P1-E, `src/lib/batches.ts`) — unreachable, including by a typed URL, whenever the global switch is off.

### Doctors (Master Data, locked 2026-07-29)

**Permanent product rule:** Doctor is a real, persisted lookup entity (`Doctor { id, name, createdAt, active }`, `src/mocks/doctors.ts` seeds it, `DataContext.doctors`/`addDoctor`), replacing the old hardcoded `DOCTORS` string tuple — but there is **no Doctors management page**, and none is planned. Every Doctor field in the app (currently `Patient.primaryDoctor`, `Case.doctor`) is a searchable, create-on-the-fly combobox (`DoctorCombobox`, wrapping the generic `src/components/ui/combobox.tsx`):
1. The field always displays/searches with the "Dr." prefix; the user only ever types the bare name. `Doctor.name` is stored **without** the prefix — every display composes `"Dr. " + name`.
2. Typing filters existing doctors live. If no doctor's name exactly matches what was typed, an `Add "Dr. <typed name>"` option appears alongside any partial matches.
3. Selecting an existing match, or pressing Enter/clicking Add, immediately resolves to a doctor and closes the picker — creation (when needed) happens inline, never as a separate step or page.
4. Before ever creating a new record, the exact name (case-insensitive) is checked against existing doctors and reused if found — `DoctorCombobox` enforces this even on the "create" path itself, so the same doctor is never duplicated no matter how it's triggered.
5. **`Patient.primaryDoctor` and `Case.doctor` remain plain display strings** (e.g. `"Dr. Alan Whitfield"`), not a foreign key to `Doctor.id`. This was a deliberate scope decision: the `Doctor` table's job is search + dedup + inline creation, not referential integrity — promoting these fields to a true FK is a future decision if Doctors ever need real profile data (specialty, license, contact info), at which point every existing display/filter/report site listed here would need updating in the same change.

### Master Data Audit (locked 2026-07-29)

Every dropdown/select in the app was reviewed and classified. Recorded here so the classification isn't silently re-litigated file-by-file later:
- **True static enums (no change):** `Sex` (Patient), every status enum (`POStatus`, `CaseStatus`, `LoanStatus`), Barcode Format (`ClinicSettings.barcodeFormat`) — these are closed, small, non-clinic-specific value sets.
- **Manufacturer / Product Category — static, but deduplicated (this change):** both are a fixed, real-world catalog (implant brands, component categories), not per-clinic data, so they stay static rather than becoming a persisted table (doing so would need a management surface, which contradicts "do not add new pages unless absolutely necessary" for something that rarely changes). They *were* independently redeclared in both `ProductsPage.tsx` and `ProductFormDialog.tsx` — a drift risk. Now defined once as `MANUFACTURERS`/`PRODUCT_CATEGORIES` in `src/types/index.ts`, imported by both.
- **Doctor — promoted to a persisted table (this change):** see the section above. The clearest case of "fake demo data that should be real" found in the audit — unlike Manufacturer/Category, clinics genuinely add their own doctors over time, so a hardcoded list was a real gap, not a legitimate static enum.
- **`PROCEDURES` (`CaseFormDialog`) and `LAB_SPECIALTIES` (`src/mocks/names.ts`) — flagged, not changed:** both have the same "clinic-specific, grows over time" shape as Doctor and are reasonable candidates for the same combobox-with-inline-create treatment in a future pass. Left alone this round to keep this change's blast radius contained to what was explicitly scoped; `LAB_SPECIALTIES` additionally has no live UI reader today (mock-seeding only), so there's nothing to wire up yet regardless.
- **Vendor, Lab, Patient (entity pickers, not master-data lists):** already real persisted entities. Their `<Select>` fields in `POFormDialog` (Vendor), `CaseFormDialog` (Patient, Lab) were plain full-list dropdowns with no search — upgraded to the same searchable `Combobox` primitive as UX polish (not a data-model change) since long lists with no filter were a genuine "unnecessary clicking" friction point.

### Inventory Movement Engine (locked 2026-07-29, P1-N)

**Permanent rule: every inventory movement is generated by a business action, never invented, and every record is a self-contained, immutable snapshot — not reconstructed later via a join.** The six supported events are Purchase Order Received, Sale (implant placed in a patient), Loan Out, Loan Return, Manual Stock Adjustment (requires a note/reason), and Product Creation (initial quantity). Recording that an implant was used in a Case (`addImplantToCase`) is **deliberately not a stock-moving event** — it is not in this list; the Sale, optionally case-linked, is what actually moves stock (unchanged from before P1-N; confirmed, not a gap).

Every `InventoryMovement` record carries, captured directly at write time by the action that creates it:
1. **`quantityBefore`/`quantityAfter`** — the product's stock immediately before and after this exact movement, always present, never optional. Computed by each mutating action from live state at the moment of the transaction — see `makeQtyTracker` in `DataContext.tsx`, which guards against the same product appearing on more than one line within a single transaction (a PO receipt or a sale/loan with duplicate product lines), since reading live `products` state per-line would give every line after the first a stale, pre-transaction value.
2. **Structured linkage, per movement type** — never a string-matched join through a business-document number:
   - **Sale**: `patientId`, `caseId`, and `doctor` (a display string, resolved from the linked Case — Sale itself has no doctor field) are all stored.
   - **Loan Out / Loan Return / Lost**: `labId` is stored. (Loans have no Case link in the data model today, so `caseId`/Doctor/Patient are never populated for loan movements — an honest limitation of the current data model, not a workaround.)
   - **PO Receive**: `vendorId` is stored. No Doctor/Patient.
   - **Manual Adjustment**: no Doctor/Patient/Vendor/Lab — nothing in the current UI captures them for an adjustment, so they stay unpopulated rather than fabricated.
3. **`reference`** — unchanged: the human-readable business-document number (PO/Loan/Sale number), for display only, not used for filtering now that structured links exist.

This is why the Inventory History page's Doctor/Patient/Vendor/Lab filters always work identically regardless of movement type — they read structured fields directly, they don't disappear or behave differently for adjustments/PO receipts/loans the way a derived join would have to.

### Audit History
- The Stock Movement log (`/inventory`, now "Inventory History") is the audit trail for inventory and the source of truth for stock auditing — append-only, every entry attributable to a user and a reason, and filterable by Product, Doctor, Patient, Vendor, Lab, Date, and Movement Type.
- Case Detail pages have their own Timeline (`CaseTimelineEvent[]`) — a separate, clinical audit trail of what happened to a treatment over time (case opened, consultation, surgery, healing checks, restoration delivered), independent of the inventory movement log.

---

## 4. Data Model

All types are defined in `src/types/index.ts`. This is the authoritative schema — read it directly for exact field names/optionality; this section explains relationships and intent.

| Entity | Key fields | Relates to |
|---|---|---|
| **Product** | `sku`, `barcode`, `qrPayload`, `manufacturer`, `category`, `quantityOnHand`, `quantityReserved`, `lowStockThreshold`, `batchTracked`, `vendorId` | belongs to one `Vendor`; referenced by `InventoryMovement`, `PurchaseOrderLine`, `LoanLine`, `SaleLine`, `CaseImplantUsage` |
| **InventoryMovement** | `productId`, `type`, `quantity` (signed), `reason`, `reference`, `performedBy` | references one `Product`; `performedBy` references an `AppUser`; `reference` is a loosely-typed pointer to a PO/Loan/Sale/Case number (string, not a real FK) |
| **Vendor** | `manufacturers[]`, `onTimeRate`, `totalOrders` | has many `PurchaseOrder`s; supplies `Product`s (via `Product.vendorId`) |
| **PurchaseOrder** | `poNumber`, `vendorId`, `status`, `lines[]` (`PurchaseOrderLine`: `productId`, `quantityOrdered`, `quantityReceived`, `unitCost`) | belongs to one `Vendor`; each line references a `Product` |
| **Patient** | `patientCode`, `firstName`/`lastName`, `primaryDoctor` | has many `Case`s (`Case.patientId`); has many `Sale`s (`Sale.patientId`, optional) |
| **Case** | `caseId` (human-readable `IDC-YYYY-00001`), `patientId`, `labId?`, `status`, `implants[]` (`CaseImplantUsage`: `productId`, `tooth`, `quantity`, `batchLot?`) | belongs to one `Patient`; optionally references one `Lab`; each implant usage references a `Product`; has a separate `CaseTimelineEvent[]` history keyed by case id (`src/mocks/cases.ts` → `caseTimelines`) |
| **Lab** | `specialties[]`, `rating`, `turnaroundDays` | referenced by `Case.labId` (optional) and `Loan.labId` (required) |
| **Sale** | `saleNumber`, `patientId?`, `caseId?`, `lines[]` (`SaleLine`: `productId`, `quantity`, `unitPrice`, `batchLot?`), `total` | optionally belongs to a `Patient` and/or `Case`; each line references a `Product` |
| **Loan** | `loanNumber`, `labId` (required — labs only), `status`, `lines[]` (`LoanLine`: `productId`, `quantityLoaned`, `quantityReturned`, `quantityLost`, `lostReason?`) | belongs to one `Lab`; each line references a `Product`; `issuedBy` references an `AppUser` |
| **LoanReturnRecord** | `loanId`, `productId`, `quantityReturned`, `quantityLost`, `lostReason?` | *(type exists in `types/index.ts` but the running app derives the Loan Returns page from `InventoryMovement` instead of a separate mutable table of this type — see §3 Returns)* |
| **AppUser** | `role` (`admin`/`clinician`/`inventory-manager`/`front-desk`), `avatarColor` | referenced by `performedBy`/`issuedBy`/`soldBy`/`receivedBy` fields across other entities |
| **ClinicSettings** | `clinicName`, `priceVisibilityDefault`, `barcodeFormat`, `lowStockGlobalDefault`, `theme`, `batchLotTrackingEnabled` | singleton — one per clinic, edited on the Settings page |

**Relationship summary (textual ER):**
```
Vendor 1─* PurchaseOrder *─* Product
Product 1─* InventoryMovement
Patient 1─* Case *─1 Lab (optional)
Case 1─* CaseImplantUsage *─1 Product
Patient 1─* Sale *─1 Case (optional)
Sale 1─* SaleLine *─1 Product
Lab 1─* Loan
Loan 1─* LoanLine *─1 Product
AppUser 1─* (performs) InventoryMovement / Loan / Sale / PurchaseOrder actions
```

All mock data is generated in `src/mocks/*.ts` with a seeded PRNG (`src/mocks/rng.ts`, `mulberry32`) so the dataset is deterministic across reloads during development, then loaded into React state by `src/store/DataContext.tsx` at app start. From that point on, **all reads and writes in the running app go through `DataContext`**, not directly through the `mocks` module — the mock files only seed the initial state.

---

## 5. Folder Structure

```
src/
├── types/index.ts        # Single source of truth for every domain type (Product, Case, Loan, ...)
├── content/
│   └── helpText.ts        # Centralized copy registry — TERMS, ICON_HELP, MICROCOPY, PAGE_INTROS, EMPTY_STATES
├── mocks/                 # Deterministic mock data generators, one file per entity, seeded PRNG
│   ├── rng.ts              # mulberry32 PRNG + helpers (pick, chance, dates...)
│   ├── names.ts             # Name pools, doctor list, lab name parts, vendor names
│   ├── products.ts, patients.ts, labs.ts, users.ts, cases.ts,
│   │ sales.ts, loans.ts, purchaseOrders.ts, inventory.ts,
│   │ vendors.ts, settings.ts
│   └── index.ts              # Re-exports everything for convenient import
├── store/
│   └── DataContext.tsx     # THE runtime source of truth — React context holding all entity arrays
│                             plus every mutating action (adjustStock, createLoan, receivePurchaseOrder, ...)
├── components/
│   ├── ui/                 # Hand-built shadcn-pattern primitives on Radix + Tailwind
│   │                         (button, dialog, sheet, table, select, tabs, dropdown-menu, command,
│   │                          tooltip, help-tooltip, avatar, badge, card, checkbox, switch, ...)
│   ├── shared/               # Cross-page building blocks: PageHeader, StatCard, StatusBadge, EmptyState, Barcode/QR
│   ├── layout/                # Sidebar, Topbar, GlobalSearch (⌘K palette), nav.ts config
│   ├── theme/                 # ThemeProvider (light/dark/system)
│   └── <module>/              # One folder per module holding its form dialogs, e.g. products/ProductFormDialog.tsx,
│                                 loans/LoanReturnDialog.tsx, purchase-orders/POReceiveDialog.tsx
├── layouts/
│   └── AppLayout.tsx        # Shell: Sidebar + Topbar + <Outlet/> + GlobalSearch + Toaster, wrapped in TooltipProvider
├── pages/
│   └── <module>/             # One folder per of the 14 modules; list pages + detail pages
│                                (e.g. cases/CasesPage.tsx + cases/CaseDetailPage.tsx)
├── lib/
│   ├── utils.ts              # cn(), formatCurrency, formatDate, formatDateTime, initials, daysBetween
│   └── chartColors.ts        # Light/dark categorical + sequential chart palette, theme-aware
├── App.tsx                  # Route table
└── main.tsx                  # Entry point — mounts <App/> inside <BrowserRouter/>
```

Root-level:
```
.claude/launch.json   # Dev server launch config for this environment (points node.exe directly at vite.js
                       # to sidestep a PATH issue in the sandboxed shell — see §12 for context)
PROJECT.md             # This file
```

---

## 6. Component Library

### `src/components/ui/` — base primitives (Radix + Tailwind, shadcn pattern)
| Component | Where to use it |
|---|---|
| `Button` | Any clickable action. Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`. Sizes: `default`, `sm`, `lg`, `icon`. |
| `Dialog` | Centered modal for focused create/edit forms (Quick Add Product, New Loan, etc.) |
| `Sheet` | Side-panel drawer for detail views that need more room / persistent context (Product Detail) |
| `Table` (+`TableHeader/Body/Row/Head/Cell`) | Any tabular list. Pair with TanStack Table for sortable columns (see `ProductsPage`'s table view). |
| `Select` | Any single-choice dropdown (filters, form fields) |
| `Tabs` | View toggles (card/table) or in-page sections (Reports' Inventory/Sales/Loans/Purchases tabs) |
| `DropdownMenu` | Overflow actions / menus (Topbar quick-create, theme switcher, avatar menu) |
| `Command` / `CommandDialog` | The global search palette only — not a general-purpose combobox |
| `Tooltip` / `TooltipTrigger` / `TooltipContent` | Low-level Radix wrapper. **Prefer `HelpTooltip`/`IconHelp`/`TermHint` from `help-tooltip.tsx` instead of using this directly** — those pull copy from the central registry. |
| `Badge` | Status pills, counts, tags. Variants map to the 5-color system (see §7). |
| `Card` (+`Header/Title/Description/Content/Footer`) | The base surface for every panel, stat, and list card |
| `Avatar`, `Progress`, `Switch`, `Checkbox`, `Separator`, `ScrollArea`, `Popover`, `Label`, `Input`, `Textarea`, `Sonner` (toast) | Standard form/feedback primitives, used as you'd expect |

### `src/components/ui/help-tooltip.tsx` — the app's teaching layer
| Component | Purpose | Example |
|---|---|---|
| `HelpTooltip` | The one reusable tooltip primitive. Hover (desktop) + tap/long-press (touch, via an explicit click-toggle since Radix hover events don't fire on touch) + keyboard focus. Takes `title`/`description`/`shortcut` directly. | Rarely used directly — prefer the two wrappers below, which pull from the registry. |
| `IconHelp` | Wraps an existing icon/button element (`asChild` pattern) with a tooltip looked up from `ICON_HELP` by key. | `<IconHelp helpKey="search"><button>...</button></IconHelp>` in the Topbar |
| `TermHint` | Inline term explainer: dotted-underline label (or icon-only) + tooltip looked up from `TERMS` by key. Keyboard-focusable. | `<TermHint term="sku" iconOnly />` next to a SKU value |

**Rule: never hardcode a tooltip's title/description in a component.** Add the entry to `src/content/helpText.ts` first, then reference it by key.

### `src/components/shared/` — cross-page building blocks
| Component | Purpose |
|---|---|
| `PageHeader` | Every page's title + one-line purpose description + right-aligned actions slot. Title/description should come from `PAGE_INTROS` in the registry. |
| `StatCard` | Dashboard/list-page KPI tile: label, big value, icon, optional trend, optional `helpTerm` (renders a `TermHint` next to the label), optional `onClick` to deep-link. |
| `StatusBadge` | Renders the correct colored `Badge` for any of the app's status enums (Case, Loan, PO, Product) from one shared color map — never hand-roll a status color elsewhere. |
| `EmptyState` | Every "nothing here yet" screen. Always pass `icon` + `title` + `description` (what/why) + an `action` button (what to do next) where a create action makes sense — copy should come from `EMPTY_STATES` in the registry. |
| `Barcode.tsx` (`BarcodeDisplay`, `QRDisplay`) | Canvas-rendered CODE128 barcode / QR code from a product's `barcode`/`qrPayload`. Always render on a white background container — the codes assume light backgrounds regardless of app theme. |

### `src/components/layout/`
| Component | Purpose |
|---|---|
| `Sidebar` | Persistent left nav, grouped (Overview/Inventory/Care/Operations/System) per `nav.ts`. Only wrap a nav item in `IconHelp` if it's ambiguous without more context — most items are self-explanatory via their label and don't need one (avoid tooltip overuse). |
| `Topbar` | Search trigger, quick-create menu, Notifications bell (derived live from low-stock + pending-PO counts, no separate notifications data model), theme switcher, avatar/account menu. |
| `GlobalSearch` | The ⌘K command palette. Searches Products/Patients/Cases/Labs client-side against `DataContext` state. |

### Form dialogs (one per module, colocated under `components/<module>/`)
Each entity that supports "create" has a dedicated `*FormDialog.tsx` (`ProductFormDialog`, `PatientFormDialog`, `CaseFormDialog`, `VendorFormDialog`, `LabFormDialog`, `LoanFormDialog`, `SaleFormDialog`, `POFormDialog`, `UserFormDialog`) plus, where the workflow needs it, a dedicated action dialog (`AdjustmentDialog`, `LoanReturnDialog`, `POReceiveDialog`, `ProductDetailSheet`'s inline adjuster). Follow this pattern for any new entity rather than inventing a new modal shape.

---

## 7. Design System

Defined in `tailwind.config.ts` and `src/index.css` (CSS custom properties, light + dark values).

- **Spacing**: Tailwind's default scale (based on 4px steps, i.e. an 8px rhythm at the values actually used — `p-2`/`gap-2` = 8px, `p-4` = 16px, etc.). No arbitrary pixel values in components.
- **Radius**: `rounded-xl`/`rounded-2xl` for cards and dialogs, `rounded-lg` for buttons/inputs — controlled centrally via the `--radius` CSS variable so it can be retuned in one place.
- **Shadows**: `shadow-soft` (subtle, resting), `shadow-card` (default card elevation), `shadow-popover`, `shadow-elevated` (dialogs, hover-lift) — never an ad-hoc `box-shadow`.
- **Typography**: System sans (`Inter var` stack) for everything, `JetBrains Mono`-style stack only for `font-mono` (Case IDs, SKUs). Numeric values that need to align (prices, quantities) use `tabular-nums`.
- **Colors** (see `tailwind.config.ts` `theme.extend.colors`, each with a light/dark HSL pair via CSS var):
  - `primary` — Blue. Default action color, active nav state, links.
  - `accent` — Teal. Secondary emphasis (e.g. "in progress"/"confirmed" states).
  - `success` — Green. Positive/completed states, stock increases.
  - `warning` — Amber. Low stock, pending, partially-received/returned states.
  - `danger` — Red. Destructive actions, stock decreases, lost components, out-of-stock.
  - `background`/`surface`/`card`/`popover`/`muted`/`border` — neutral scale, off-white in light mode, near-black in dark mode. **No gradients** except the two subtle area-chart fill gradients on the Dashboard.
- **Icons**: `lucide-react` exclusively, `h-4 w-4` in most inline contexts, `aria-hidden="true"` on every icon that sits next to a text label or already has an `aria-label` on its parent button.
- **Cards**: `Card` + `CardHeader/Title/Description/Content/Footer` — every panel on every page is built from this, never a raw `<div>` with manual border/shadow classes.
- **Buttons**: see `buttonVariants` in `ui/button.tsx` — 6 variants × 4 sizes, one definition, used everywhere. Icon-only buttons **must** have an `aria-label`.
- **Tables**: `ui/table.tsx` primitives; sortable tables use TanStack Table's `useReactTable` (see `ProductsPage`).
- **Forms**: `react-hook-form` + `zod` for validated forms (`ProductFormDialog` is the reference example); simpler dialogs (loan/PO/sale line-item builders) use plain `useState` where a full RHF schema would be overkill — both patterns are acceptable, pick based on form complexity.
- **Status badges**: always via `StatusBadge`, never inline `<Badge variant="...">` for a status enum — the color mapping lives in exactly one place (`components/shared/StatusBadge.tsx`).
- **Tooltip behavior**: hover (desktop, 300ms delay), tap/long-press (touch), keyboard focus — all via `HelpTooltip`/`IconHelp`/`TermHint`. Subtle fade/zoom only (150ms), no elaborate motion. Never the only way to access critical information — tooltips supplement visible microcopy, they don't replace it.
- **Empty states**: always `icon` + `title` + `description` (what this page is / why it's empty) + an `action` (what to do next) — see `EmptyState` component and `EMPTY_STATES` registry.
- **Page introductions**: every page's `PageHeader` carries a one-line description of the page's purpose, sourced from `PAGE_INTROS` — see `helpText.ts`.
- **Accessibility**: icon-only buttons carry `aria-label`; interactive elements are real `<button>`/`<a>` tags (never a `<div onClick>`); focus rings are the Tailwind `focus-visible:ring-2 focus-visible:ring-ring` pattern baked into every primitive; tooltips are reachable and dismissible via keyboard (Radix Tooltip's native focus/Escape handling); color is never the only signal for status (badges/icons pair a color with a label, never color alone).

---

## 8. Terminology

This is the **single source of truth** for product vocabulary — duplicated intentionally from `src/content/helpText.ts` (`TERMS`) so it's readable without opening the code, but that file is the one actually consumed by the UI. If you change a definition, change it there and mirror it here in the same change.

| Term | Definition |
|---|---|
| **SKU** | Unique code used to identify this component. |
| **Barcode** | Scan instead of typing to instantly identify a component. |
| **QR Code** | Alternative scannable code that opens the component details. |
| **Batch Number** | Manufacturer's production batch used for traceability. |
| **Low Stock** | Quantity has reached its reorder level. |
| **Reserved Stock** | Components already allocated to a patient case but not yet used. |
| **Stock Movement** | Any action that changes inventory such as purchase, sale, loan, return or adjustment. |
| **Adjustment** | Manual correction made when physical stock does not match the system. |
| **Patient** | Person receiving implant treatment. |
| **Case** | One implant treatment linked to a patient. |
| **Case ID** | Automatically generated unique identifier for this treatment (format `IDC-YYYY-00001`). |
| **Vendor** | Company from whom components are purchased. *(Never "Supplier" — see below.)* |
| **Lab** | Dental laboratory working on the implant case. *(Never "Laboratory" in UI copy — "Lab" is the short form used consistently; "laboratory" is fine only as a plain English word inside a longer descriptive sentence, not as the entity name.)* |
| **Purchase Order** | Record of components ordered from a vendor before they arrive. *(Never bare "Order" in UI copy.)* |
| **Loan** | Component temporarily sent to a dental laboratory and expected to be returned. |
| **Return** (a.k.a. "Loan Return") | Records that a loaned component has been received back into inventory. |

**Words that must never appear as a synonym for the above** (this list exists because these exact substitutions were found and fixed during the UX polish pass — do not reintroduce them):
- "Supplier" → always **Vendor**
- "Correction" / "Stock Correction" → always **Adjustment**
- bare "Order" → always **Purchase Order**
- bare "Movement" (as a page/section label) → always **Stock Movement**
- "Component" used as the entity-type label where "Product" is meant (e.g. table/column headers, stat labels) → use **Product**. ("Component" remains fine as generic descriptive language in free-text reasons/notes — that's natural English, not a mislabeled entity.)

**Adjacent-but-distinct terms** (not synonyms, don't conflate them):
- **Doctor** (`Patient.primaryDoctor`, `Case.doctor`) — a free-text clinician name associated with a patient/case. Not the same as...
- **Clinician** (`AppUser.role`) — a system login/permission role for staff. A "Doctor" on a case is clinical data; a "Clinician" is an account type.

---

## 9. Current Limitations

Everything below is **intentional** for this stage of the project — do not "fix" these without an explicit decision to move toward MVP (see §10):

- **No backend, no database, no API.** Everything lives in `src/store/DataContext.tsx` React state, seeded once from `src/mocks/*`. A hard page reload resets all data to the deterministic seed.
- **No authentication.** `currentUser` is a hardcoded mock (`src/mocks/users.ts`); there is no login screen, no session, no per-request permission enforcement. The Role Permissions matrix on the Users page is documentation of *intended* behavior, not enforced behavior. **(Status 2026-07-30: a role-based access-control pass was scoped and partially planned in-session — see the open task list if picking this up mid-stream — but not shipped; this limitation still holds as of the last commit.)**
- **Persistence exists but is client-only.** As of an earlier round, every business-data slice in `DataContext` is persisted to `localStorage` (`src/store/persistence.ts`, key `implantdesk:data:v1`) and rehydrated on load — a page reload no longer resets data to the seed. This is still not a real backend: it's per-browser, has no multi-user sync, and a cleared browser storage still means data loss.
- **Barcodes/QR codes are fake payloads**, not scannable against any real product registry or GS1 standard — they are deterministic strings generated for visual realism only.
- **Edit flows exist for Products and Patients** (`ProductFormDialog`/`PatientFormDialog` both support an edit mode) — the "no delete/edit flows" limitation from an earlier snapshot of this document no longer holds for those two entities. Delete flows still don't exist anywhere (by design — see the append-only audit history convention in §3); most other entities (Vendors, Labs, Doctors) still have no edit UI, only create.
- **No real financial rules.** Currency formatting is illustrative (`Intl.NumberFormat`), there's no tax handling, multi-currency is a cosmetic Settings field only.
- **`LoanReturnRecord` type is unused by the running app.** The Loan Returns page is derived live from `InventoryMovement` records instead (see §3 Returns) — this was a deliberate simplification to avoid two sources of truth for the same data; the type stays in `types/index.ts` for schema completeness but nothing constructs it at runtime.
- **P1-I, P1-J, and P1-K all shipped 2026-07-30 — Priority 1 is now complete except P1-H (still blocked).** Reports has 9 tabs (P1-I). Every list page has a working, filter-respecting "Export CSV" action (P1-J). Products can now be bulk-imported from CSV with a mandatory preview-before-commit step (P1-K) — SKU/barcode/vendor are always auto-generated/auto-matched, never user-supplied, exactly like manual product creation, and the whole valid batch commits atomically via `DataContext.importProducts`. The next milestone is `DEVELOPMENT_PLAN.md` Priority 2's remaining items, P2-B (Lab cases drill-down) or P2-C (Users role editing) — see `HANDOFF.md` §8, which also flags that an in-session ad-hoc request scoped a larger Access-Level/permissions system that may supersede P2-C's simpler scope.
- **P1-G (Core Transactional Documents) shipped 2026-07-30.** Purchase Order PDF, Sales Invoice, Sales Delivery Challan, Loan Out Slip, and Case Summary are all real, working documents (`src/lib/documents/`) with Print/PDF/WhatsApp-share actions on their respective detail pages. A Goods Received Note and a standalone Loan Return Receipt were deliberately not built as separate documents — the PO document's "Received" column and the Loan document's live loaned/returned/lost/outstanding state cover the same underlying need without duplicating a template (see `DEVELOPMENT_PLAN.md`'s P1-G status note for the full rationale).
- **Mock/demo data is a development-only scaffold, not production content** (see §2b, Production Data Policy). `src/mocks/*` currently seeds every entity for ease of development and testing; production builds must always start with an empty business database. This is not yet implemented — tracked as a placeholder milestone in `DEVELOPMENT_PLAN.md` (Deferred Infrastructure & Backend Work) so it isn't silently forgotten.
- **Large single JS chunk on production build** (`npm run build` warns about a ~1.27MB bundle). Acceptable for a demo; would need route-level code-splitting (`React.lazy`) before shipping to real users on slow connections.
- **`src/mocks/loans.ts` assigns each mock loan line a freshly-random `LOT-XXXXX` lot number** instead of reusing one actually received via a PO (`batchLotByPoLine`, found during P1-N verification). This can make `summarizeLots` show a negative "remaining" for a handful of synthetic mock lots — a mock-data-generation quirk, not a bug in `summarizeLots` itself or in any live `DataContext` action, both of which are correct given complete data. Not fixed as part of P1-N (out of scope); worth fixing if `src/mocks/loans.ts` is ever touched again.
- **Plain `npx tsc --noEmit` is a no-op in this repo** — the root `tsconfig.json` uses TypeScript project references with `files: []`, so it silently checks zero files and always exits 0. Always use `npx tsc -b --noEmit` (or `npx tsc -b`, matching `npm run build`). Discovered mid-P1-N; every earlier session's "tsc clean" claim used the broken form.

---

## 10. Future Roadmap

Suggested only — **nothing below is implemented**, and nothing here should be treated as promised or scheduled.

### Prototype (this stage → hardening)
- Edit/Delete flows for every entity, with the Super Admin gate actually enforced in the UI (even without real auth, gate it behind the mock `currentUser.role`).
- Route-level code-splitting to shrink the initial bundle.

### MVP (first real backend)
- Real backend + database behind the exact same `DataContext` action surface (`adjustStock`, `createLoan`, `receivePurchaseOrder`, etc.) — those functions are already the correct integration seam; swap their bodies for API calls / a mutation library (e.g. TanStack Query) without touching page components.
- Authentication (even a simple email/password or magic-link flow) and real session-based permission enforcement matching the existing Role Permissions matrix.
- Persistence — every mutation survives a reload.
- Real, scannable barcodes (GS1/CODE128 compliant) tied to an actual product master.
- Basic audit export (CSV/PDF) of the Stock Movement log for compliance.

### Production
- Multi-location/multi-clinic support (currently the data model assumes a single clinic).
- Expiry-date tracking and alerts for batch-tracked graft material/membranes.
- Real notification delivery (email/SMS/push) for low stock and overdue loans, not just the in-app bell.
- Reconciliation tooling: a guided "cycle count" flow that turns a physical count into a batch of reason-required adjustments.
- Reporting exports and scheduled report emails.

### Enterprise
- Role-based access control beyond the current 4 fixed roles (custom roles/permission sets).
- Multi-vendor price comparison and automated reorder-point purchase order generation.
- Integration with lab management systems (structured loan/case handoff instead of free-text).
- Full audit/compliance mode (immutable event log, e-signature on high-risk actions like write-offs).
- Multi-currency, multi-tax-jurisdiction financials.

---

## 11. Development Guidelines

- **Prefer reusable components.** Before writing a new UI pattern, check `components/ui/` and `components/shared/` — almost everything needed already exists (see §6).
- **Avoid duplicated logic.** Status color mapping, currency/date formatting, ID-sequence generation, and stock-mutation logic each live in exactly one place (`StatusBadge`, `lib/utils.ts`, `DataContext`'s `nextId`/entity-specific number generators, `DataContext`'s action functions respectively). Don't reimplement any of them inline in a page.
- **Never hardcode business rules.** Loan-labs-only, reason-required-for-adjustments, Case ID format, etc. belong in `DataContext` action functions and/or form validation — not scattered as inline `if` checks copy-pasted across pages.
- **Store explanatory text centrally.** Any tooltip, hint, empty state, or page-purpose copy goes in `src/content/helpText.ts`, referenced by key. Do not write a description string directly into a page/component.
- **Maintain accessibility.** Every icon-only interactive element needs `aria-label`. Every new interactive control must be reachable and operable by keyboard. Don't introduce color-only signals.
- **Maintain consistent terminology.** Cross-check new copy against §8 before writing it. When in doubt, search `helpText.ts` first — the word you need is probably already defined there.
- **Keep pages simple.** One clear primary action per page (usually top-right in `PageHeader`'s `actions` slot). Favor a single-purpose `Dialog`/`Sheet` over multi-step wizards.
- **All state mutation goes through `useData()` (`DataContext`).** Pages and components should never mutate mock data or hold their own duplicate copy of shared entities — read and write through the context so every consumer stays in sync (see the fixed "stale product sheet" bug in §12 for why this matters).
- **Run `npx tsc -b --noEmit` after any non-trivial change** before considering it done — this codebase has caught real bugs (stale references, union-type narrowing) purely from the type checker; don't skip it.

---

## 12. Session Handoff ("Where we currently are")

> **This section is a historical snapshot predating even Phase 3 (the Purchase Order workflow) and is badly out of date — do not treat anything below as current state.** For the actual current state, always read **`HANDOFF.md`** instead (§2 for repo/commit state, §5 for the full chronological changelog, §6 for the live roadmap position). This section is kept for history only and should eventually be trimmed; not done here to stay within this session's single-milestone scope.

### What has already been completed
1. **Full functional prototype** — all 14 modules built, routed, and interactive: Dashboard, Products, Inventory, Purchase Orders, Vendors, Patients (+ profile), Cases (+ detail/timeline), Labs (+ detail), Sales, Loans, Loan Returns, Reports, Users, Settings.
2. **Realistic seeded mock data**: 100 products, 40 patients, 25 labs, ~150 stock movements, 40 loans, 30 sales, plus vendors/POs/cases/users, all deterministic and cross-referenced.
3. **Shared runtime state** (`DataContext`) wired end-to-end so actions in one place reflect live everywhere (verified in-browser: creating a case, adjusting stock, processing a loan return, receiving a PO, and global search all round-trip correctly with no console errors).
4. **Two real bugs found and fixed during in-browser testing**:
   - Stale product reference in the Product Detail sheet (fixed by tracking `selectedId` and deriving the live product from `DataContext` state instead of holding a snapshot).
   - cmdk's built-in fuzzy filter was fighting the app's own manual search filtering in the global search palette, causing "No results" even for valid matches (fixed with `shouldFilter={false}` + a manually-computed empty state).
5. **UX polish pass** (this most recent phase of work):
   - Central help-text registry (`src/content/helpText.ts`): `TERMS`, `ICON_HELP`, `MICROCOPY`, `PAGE_INTROS`, `EMPTY_STATES`.
   - Reusable tooltip system (`src/components/ui/help-tooltip.tsx`): `HelpTooltip`, `IconHelp`, `TermHint` — hover + tap/long-press + keyboard accessible.
   - Topbar icon tooltips (Search, New, Notifications, Theme, Profile) + a new Notifications bell (derived live from low-stock + pending-PO counts, no new data model).
   - Page intros applied to all 14 pages via `PAGE_INTROS`.
   - Educational empty states applied to all 10 list pages via `EMPTY_STATES`, each with a "what/why/what-next" CTA.
   - Term tooltips wired at the highest-value spots: Product Detail sheet (SKU, Barcode, QR Code, Reserved Stock, Low Stock, Batch Number), Dashboard/Inventory/Loans stat cards, Cases/Loans table headers (Case ID, Loan #).
   - Form microcopy added: Minimum Stock, Purchase Price, Selling Price, Case ID, Reason (adjustment + lost-component), Batch Number, Due Date, ETA, Price Visible, Batch Tracked.
   - Terminology consistency fixes applied per an explicit audit: Supplier→Vendor, Correction→Adjustment, bare Order→Purchase Order, bare Movement→Stock Movement, Component→Product where it labeled the entity type.
   - Accessibility pass: `aria-label` added to every previously-unlabeled icon-only button; verified focus-visible rings exist on all interactive primitives (they were already baked into `ui/button.tsx`, `ui/input.tsx`, etc. from the initial build).
   - `npx tsc -b --noEmit` passes clean after all of the above (one type error surfaced and was fixed: a union-narrowing issue in `IconHelp` reading `entry.shortcut`).

### What still needs work
1. **This UX polish pass has not yet been re-verified live in the browser** after the terminology/microcopy edits — the last in-browser verification round happened before this pass started. Before calling this phase done: start the dev server, click through Products (SKU/Barcode/QR/Reserved/Low Stock tooltips + empty state + Quick Add microcopy), Inventory (empty state + Adjustment reason microcopy), Loans (exact "No Active Loans" empty state copy), Purchase Orders (fixed "Create Draft Purchase Order" button + line-item column labels), Vendors ("vendor" not "supplier" everywhere), Settings (Minimum Stock / Barcode Settings tooltips) — in both light and dark mode, and confirm no console errors and no visual regressions (e.g. the `TermHint` icon-only styling next to badges/labels should look tidy, not cramped).
2. **`npm run build` has not been re-run** after this pass (only `tsc --noEmit` was checked). Run it to catch any bundling issues before considering the polish pass complete.
3. Sidebar tooltips were deliberately limited to Dashboard and Settings only (the two items explicitly named in the spec's icon examples) — confirm this reads as intentional restraint rather than inconsistency, or extend/remove as needed.
4. Not yet addressed from the original UX request: a systematic pass confirming *every* instance of the 15 canonical terms in §8 has appropriate tooltip coverage everywhere it appears (the current pass covered the highest-traffic spots — Product Detail, Dashboard, list-page stat cards, Cases/Loans headers — but a few list pages' page-level titles/descriptions rely on `PAGE_INTROS` prose alone without an inline `TermHint`, e.g. Vendors/Labs page titles don't have a `TermHint` next to "Vendors"/"Labs" themselves, only in body copy).
5. Items 1–3 of the "Development Guidelines" self-check (§11) should be run once more as a final gate: reusability check, duplicated-logic check, and terminology cross-check across the whole diff of this polish pass.

### Recommended next development order
1. Re-verify the UX polish pass live in-browser (light + dark mode) per item 1 above — fix anything visually cramped or inconsistent before moving on.
2. Run `npm run build` and resolve any new warnings/errors.
3. Do a final terminology grep pass (`Supplier`, `Correction`, bare `Order`/`Movement`, mismatched `Component`/`Product`) across the *whole* repo one more time to catch anything the first audit missed, now that new copy has been added.
4. Decide whether to close the "not yet addressed" gap in item 4 above (extra `TermHint`s on remaining page titles) or explicitly accept the current coverage as sufficient — either is fine, but make the decision explicit rather than leaving it ambiguous.
5. Only after the above: consider moving into "Prototype hardening" work from §10 (Edit/Delete flows, wiring `barcodeFormat`, code-splitting) — do not start roadmap work while the current polish pass is still unverified.

### Known environment quirks (useful if picking this up in a new session)
- This machine did not have Node.js on `PATH` in the sandboxed shell even after installation — every `node`/`npm` command needs `export PATH="/c/Program Files/nodejs:$PATH"` prepended (Bash) or the equivalent for PowerShell. The dev-server launch config (`.claude/launch.json`) works around a related issue by pointing `runtimeExecutable` directly at `node.exe` invoking `node_modules/vite/bin/vite.js`, rather than `npm run dev`, because `npm.cmd` itself couldn't resolve `node` on PATH inside the preview-server sandbox.
- The Browser-pane `navigate` tool in this environment does not reliably honor a path in the URL (it consistently lands on `/` regardless of what path was requested) — use `window.location.href = '/some-path'` via the JS execution tool, or click an in-app `<a>`/`<NavLink>` element, to navigate to a specific route during testing. This is a tooling quirk, not an app bug.
- A full browser reload resets all in-memory mock state by design (see §9) — don't mistake this for a persistence bug when testing.
