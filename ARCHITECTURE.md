# ARCHITECTURE.md — Engineering Review of ImplantDesk (v1.8 prototype)

> Scope: this document is an independent engineering audit of the codebase as it exists today, produced by reading every source file under `src/`, the build/tooling config, and the project's own handoff document (`PROJECT.md`). It is written for whoever plans ImplaTrax's production build. It intentionally does not propose UI changes and no code was modified to produce it.
>
> A very thorough internal spec, `PROJECT.md`, already exists at the repo root and should be treated as the domain/business-rules source of truth — this document does not repeat that content wholesale. Where this review's findings differ from or add to `PROJECT.md`'s self-assessment (mostly in the Weaknesses/Technical Debt sections), that is because this pass verified claims against the actual code rather than against intent.

---

## 1. Overall Architecture

ImplaTrax is a **client-only, single-page React application**. There is no backend, no API layer, and no persistence beyond a single `localStorage` key for theme preference. It is best described as a "high-fidelity clickable prototype with real state" — every interaction is real (data actually mutates, derived views actually update), but the entire universe of data lives in one in-memory React context that resets on reload.

**Stack:**
| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript, built with Vite 6 |
| Routing | `react-router-dom` v6, all routes flat-mounted under one layout route |
| Global state | A single React Context (`DataContext`) holding every entity array + every mutating action |
| Forms | `react-hook-form` + `zod` for complex forms; local `useState` for simpler line-item builders (both patterns coexist by design) |
| Styling | Tailwind CSS 3, CSS-variable-driven design tokens, dark mode via `.dark` class |
| Component primitives | Hand-rolled shadcn-style wrappers around Radix UI primitives (not the shadcn CLI/library itself — these are bespoke files in `components/ui/`) |
| Tables | TanStack Table (`@tanstack/react-table`) for the one sortable table (Products) |
| Charts | Recharts, themed via a small custom color-token module |
| Data generation | A hand-written deterministic mock-data layer seeded with a custom `mulberry32` PRNG |

**Runtime data flow, end to end:**
```
src/mocks/*.ts  (seed generators, run once at module load, deterministic PRNG)
      │
      ▼
src/store/DataContext.tsx  (React state, seeded from mocks/* at DataProvider mount)
      │  useData() hook
      ▼
Pages (src/pages/**)  ──read/write──▶  Form dialogs (src/components/<module>/*FormDialog.tsx)
      │
      ▼
Shared/UI components (src/components/shared, src/components/ui) — presentational only
```

This is a clean, conventional shape for a prototype and — critically — **the mutation surface is already API-shaped**. `DataContext`'s exported actions (`adjustStock`, `createLoan`, `receivePurchaseOrder`, `createSale`, etc.) read like the method list of a real service/repository layer, not like ad-hoc `setState` calls. This is the single most important structural fact for planning 2.0: a real backend can very plausibly be introduced *underneath these exact function signatures* without touching a single page component, provided the internals of `DataContext` are given a seam to do so (see §7 and `DEVELOPMENT_PLAN.md`).

There is currently **no version control** — this directory is not a git repository (confirmed: no `.git`), despite having a `.gitignore`. This should be the literal first action taken on this codebase, before any refactor begins (see Milestone 0 in the development plan).

---

## 2. Folder Structure

```
src/
├── types/index.ts        # Single source of truth for every domain type
├── content/helpText.ts   # Centralized copy registry (TERMS, ICON_HELP, MICROCOPY, PAGE_INTROS, EMPTY_STATES)
├── mocks/                 # Deterministic mock data generators, one file per entity + rng.ts
├── store/DataContext.tsx  # The runtime source of truth — all entity state + all mutating actions
├── components/
│   ├── ui/                # Radix-based primitives (button, dialog, sheet, table, select, ...)
│   ├── shared/             # Cross-page building blocks (PageHeader, StatCard, StatusBadge, EmptyState, Barcode)
│   ├── layout/             # Sidebar, Topbar, GlobalSearch, nav.ts
│   ├── theme/              # ThemeProvider
│   └── <module>/           # One folder per module's form dialogs (products/, loans/, cases/, ...)
├── layouts/AppLayout.tsx  # Shell: Sidebar + Topbar + <Outlet/> + GlobalSearch + Toaster
├── pages/<module>/         # One folder per of the 14 routed modules
├── lib/                    # utils.ts (cn/format helpers), chartColors.ts
├── App.tsx                 # Flat route table
└── main.tsx                 # Entry point
```

This is a **feature-adjacent, not feature-sliced** structure: types, mocks, and store are each centralized single points (good), while UI is split `ui/` (generic) → `shared/` (cross-domain) → `<module>/` (domain-specific) → `pages/<module>/` (routed screens). For an app of this size (14 modules, ~85 source files) this is the right level of nesting — not over-engineered, not flat-and-chaotic. It reads consistently from module to module, which is a genuine strength (see §5).

One structural inconsistency: mock data files are organized **by entity** (`mocks/products.ts`, `mocks/loans.ts`, ...), while everything else (`components/`, `pages/`) is organized **by module/route**. This is fine as-is (entities and modules mostly map 1:1 here), but it's worth naming explicitly because it's the reason the `mocks/*` helper functions (`productById`, `labById`, etc.) can end up feeling like a legitimate "data access layer" and get imported directly into pages/components instead of going through `DataContext` — which is a real bug source (§6, §7).

---

## 3. Component Hierarchy

```
main.tsx
└── App.tsx
    └── ThemeProvider
        └── DataProvider                      (src/store/DataContext.tsx)
            └── <Routes>
                └── AppLayout                  (persistent shell, one instance for the whole app)
                    ├── TooltipProvider
                    ├── Sidebar / SidebarNav + mobile Sheet drawer
                    ├── Topbar (search trigger, quick-create menu, notifications, theme, account)
                    ├── <Outlet/>              (14 route components swap here)
                    ├── GlobalSearch (⌘K CommandDialog, portal-rendered)
                    └── Toaster (sonner, portal-rendered)
```

Each of the 14 routed modules follows the same internal shape:
```
pages/<module>/<Module>Page.tsx         — list view: PageHeader + filters + Table/Cards + EmptyState
pages/<module>/<Module>DetailPage.tsx   — (where applicable) detail view, own route, own data derivation
components/<module>/<Module>FormDialog.tsx  — the "create" flow, a Dialog
components/<module>/<Module>ActionDialog.tsx — (where applicable) a workflow-specific dialog,
                                                 e.g. POReceiveDialog, LoanReturnDialog, AdjustmentDialog
```
This repetition is intentional and is the app's strongest architectural asset (see §5) — a new engineer who has read one module (e.g. Loans) can predict the shape of every other module before opening it.

Two structural exceptions worth flagging for anyone extending the pattern:
- `Sidebar.tsx` also exports `SidebarBrand`/`SidebarNav` for reuse inside `Topbar.tsx`'s mobile drawer (`components/layout/Topbar.tsx:51-55`) — a small but real cross-import between two files in the same folder that could be pulled into a third file (`SidebarShell.tsx`) for clarity, though at current size it's a non-issue.
- `ProductsPage` is the only list page using TanStack Table + a card/table view toggle; every other list page is table-only. This is a deliberate, documented choice (Products is the only entity dense enough to need sortable columns), not an inconsistency — but it means the "sortable table" pattern only has one worked example in the codebase, which raises the cost of adding a second one from scratch.

---

## 4. Shared Components

`src/components/shared/` (cross-page, domain-aware) and `src/components/ui/` (generic, domain-agnostic) form a genuinely well-factored two-tier library:

**`components/ui/` — primitives** (`Button`, `Dialog`, `Sheet`, `Table`, `Select`, `Tabs`, `DropdownMenu`, `Command`, `Tooltip`, `Badge`, `Card`, `Avatar`, `Progress`, `Switch`, `Checkbox`, `Separator`, `ScrollArea`, `Popover`, `Label`, `Input`, `Textarea`, `Sonner`) — thin Radix wrappers styled with `class-variance-authority`. These are consistent, typed, and reused everywhere; no page hand-rolls a modal, dropdown, or table.

**`components/shared/` — the app's real reusable layer:**
- `PageHeader` — every page's title/description/actions slot, sourced from the `PAGE_INTROS` registry.
- `StatCard` — the KPI-tile pattern used on Dashboard and most list pages, with an optional `TermHint` and deep-link `onClick`.
- `StatusBadge` (`components/shared/StatusBadge.tsx`) — the single place status-enum → badge-color mapping lives, consumed everywhere a `CaseStatus`/`LoanStatus`/`POStatus`/product status is rendered. This is exactly the right pattern (one source of truth for a cross-cutting concern) even though its internal typing is weaker than it looks (§6).
- `EmptyState` — every "nothing here" screen, sourced from the `EMPTY_STATES` registry, always icon + title + description + action.
- `Barcode.tsx` (`BarcodeDisplay`/`QRDisplay`) — canvas-rendered CODE128/QR from `jsbarcode`/`qrcode`.

**The teaching layer** (`components/ui/help-tooltip.tsx` + `content/helpText.ts`) is the most distinctive architectural decision in the codebase and deserves separate call-out: `HelpTooltip`/`IconHelp`/`TermHint` are the only sanctioned way to attach explanatory copy to an element, and that copy is never inlined — it's always looked up by key from `TERMS`/`ICON_HELP`/`MICROCOPY`/`PAGE_INTROS`/`EMPTY_STATES` in `content/helpText.ts`. This means the entire product's voice/tone lives in one ~300-line file and can be edited without touching a single component. This pattern is followed with real discipline — a grep across `src/` found no hardcoded tooltip strings living outside the registry.

Net effect: before writing any new UI, `components/ui/` + `components/shared/` + `content/helpText.ts` already cover the large majority of what a new module would need. This is a strength worth explicitly preserving in 2.0, not replacing.

---

## 5. Existing Strengths

Worth stating plainly, since a review otherwise skews toward what's wrong: this is an unusually disciplined prototype codebase, and 2.0 should evolve it, not replace it.

1. **One consistent module pattern, applied to all 14 modules without exception.** List page → detail page (where relevant) → form dialog → action dialog. Once understood once, it's understood everywhere.
2. **A real centralized copy/content system** (`content/helpText.ts`), enforced by convention and (per `PROJECT.md`) an explicit terminology audit. No component-level string literals for tooltips/empty-states/page intros.
3. **A single, correctly-factored status-color mapping** (`StatusBadge`) instead of the far more common anti-pattern of `<Badge variant={status === 'x' ? 'y' : 'z'}>` scattered per page.
4. **The mutation API is already service-shaped.** `DataContext`'s public actions (`createLoan`, `receivePurchaseOrder`, `returnLoanLines`, `createSale`, `adjustStock`, ...) read like a backend's method surface, each pairing state changes with an audit record (`addMovement`) — see §1. This dramatically lowers the cost of the eventual backend swap (§9, and Milestone 6 in the development plan).
5. **A genuinely deterministic mock-data layer.** `mulberry32` seeded PRNG (`mocks/rng.ts`) means the ~100 products / 40 patients / 25 labs / ~150 movements / 40 loans / 30 sales dataset is byte-for-byte stable across reloads — a real engineering choice, not an accident, and it makes bug reports reproducible during this stage.
6. **Type coverage is strong and the domain model (`types/index.ts`) is coherent** — signed `InventoryMovement.quantity`, derived (not stored-then-drifting) `POStatus`/`LoanStatus`, and an explicit note in the type file itself (`LoanReturnRecord`) documenting a deliberate simplification. Optional fields are used correctly (`Case.labId?`, `Sale.caseId?`) to model genuinely optional relationships rather than being sprinkled defensively.
7. **Accessibility was actually done, not just claimed**: every icon-only button carries `aria-label` (verified via spot-checks across `Topbar.tsx`, `LoanFormDialog.tsx`, `ProductDetailSheet.tsx`), focus-visible rings are baked into the primitives, and tooltip content is reachable by keyboard via Radix's native handling.
8. **`tsc -b --noEmit` and ESLint are both configured and, per the project's own account, are being run as a gate** — a lightweight but real quality bar that a prototype could easily have skipped.

---

## 6. Weaknesses

These are problems observable in the running app / type system today, distinct from "features not yet built" (which `PROJECT.md` §9 already documents honestly and which this review doesn't re-litigate).

### 6.1 Confirmed bug: stale entity lookups bypass `DataContext` in multiple places
`PROJECT.md` §12 documents that a "stale product reference in the Product Detail sheet" bug was found and fixed once, by switching that one component to derive from live `DataContext` state. **The underlying pattern was not eliminated elsewhere.** Verified live instances of the same bug class still in the code:

- `src/pages/dashboard/DashboardPage.tsx:26,166` imports `productById` from `@/mocks/products` — a function that closes over the **static seed array** (`src/mocks/products.ts:159-161`), not `DataContext`. Any product created during the session (`ProductFormDialog` → `addProduct`) is invisible to this lookup. Reproduce: create a new product with an opening stock quantity, then look at Dashboard → Recent Activity — the resulting `inbound` movement renders `product?.name ?? 'Unknown product'` → **"Unknown product"**, even though the product exists and is correctly shown on the Products page.
- `src/pages/dashboard/DashboardPage.tsx:25,222` does the same with `labById` from `@/mocks/labs` for the Outstanding Loans widget — create a new Lab, issue a Loan to it, and the widget renders a blank name (`{lab?.name}` → `undefined`, no fallback text at all).
- `src/components/products/ProductDetailSheet.tsx:17,28` imports the static `vendors` array directly from `@/mocks/vendors` instead of `useData().vendors`, for the "Vendor" field shown in the sheet.
- The same static-import pattern recurs for `userById`/`caseById`/`poById`/`saleById`/`loanById`/`patientById` (`src/mocks/*.ts`) and is imported directly into several pages/components (see `src/pages/dashboard/DashboardPage.tsx:27`, `src/pages/inventory/InventoryPage.tsx:14`, `src/pages/labs/*`, `src/pages/cases/CaseDetailPage.tsx:12`, etc.) — most of these are currently low-risk only because the entities they resolve (`currentUser`, seeded cases/sales) are never created fresh mid-session, but the pattern is present as a landmine for whoever adds the next feature.

This is worth fixing as one focused pass, not case-by-case, because it is a **single root cause**: the `mocks/*.ts` modules export both (a) seed generators, which is correct and necessary, and (b) `*ById` convenience lookups over the static seed array, which look like a data-access API but silently diverge from the live store the moment any create-action runs. The fix is architectural (see §8), not a one-line patch per call site.

### 6.2 Business-rule enforcement lives only in the UI, not in the mutation layer
`adjustStock` (`src/store/DataContext.tsx:105-111`) performs no validation — the "reason is required" rule is enforced only by the calling dialogs (`AdjustmentDialog`, `ProductDetailSheet.tsx:31-34`). Same for "loans can only go to labs" (enforced in `LoanFormDialog.tsx:38-41`, not in `createLoan`). `PROJECT.md` §3 already flags this as intentional-for-now, but it's worth restating as an architecture weakness rather than a scope note: **any future caller of `DataContext`'s actions — a new dialog, a bulk-import feature, a keyboard shortcut — silently bypasses every business rule**, because the rules aren't attached to the functions that are supposed to be the integration seam for a real backend (§1, §9). This is the single highest-leverage fix before building anything else on top of `DataContext`.

### 6.3 Sequence-based ID/number generation is fragile
PO numbers, loan numbers, sale numbers, patient codes, and Case IDs are all derived from `array.length + 1` at call time (e.g. `src/store/DataContext.tsx:139,192,249,271,279`). This works only because nothing is ever deleted and only one client ever mutates state. It will silently produce duplicate/incorrect numbers the moment either assumption breaks (a delete flow — already on the roadmap per `PROJECT.md` §10 — or a second concurrent user against a real backend). This needs to become a persisted, atomic counter (or backend-assigned) before Milestone covering delete flows or backend integration.

### 6.4 `StatusBadge`'s type safety is weaker than its call sites suggest
`STATUS_CONFIG` in `src/components/shared/StatusBadge.tsx:8` is typed `Record<string, {...}>`, and `AnyStatus` (line 4) is a union of the real status types — but nothing ties the two together. Adding a new value to `CaseStatus`/`LoanStatus`/`POStatus` in `types/index.ts` does **not** produce a compile error if the corresponding entry is missing from `STATUS_CONFIG`; it silently falls back to `{ label: status, variant: 'outline' }` (line 32) at runtime. Given how central `StatusBadge` is (§4), this is a cheap, high-value type-safety fix (make `STATUS_CONFIG` an exhaustive mapped type over the union, so a missing case is a build error, not a silent visual fallback in production).

### 6.5 No automated tests exist
Confirmed by search: zero `*.test.*`/`*.spec.*` files anywhere under `src/`. Correctness today rests entirely on `tsc --noEmit`, ESLint, and manual in-browser click-through (per `PROJECT.md` §12, and that manual pass is itself noted as not-yet-re-verified after the latest change). For a codebase whose core value proposition is *inventory-accuracy correctness* (every mutation must produce a paired, correctly-signed movement — `PROJECT.md` §2), this is the most consequential gap: the business logic most worth protecting (`DataContext`'s action functions) is exactly the part with no regression safety net.

### 6.6 No version control
Already noted in §1 — there is no `.git` directory. Every finding above, and every future refactor, is currently undoable only by manual file recovery. This should be fixed before Milestone 1, not bundled into it.

---

## 7. Technical Debt

Distinct from "bugs" (§6) — these are things that work today but will cost more the longer they're deferred.

1. **Monolithic `DataContext`.** All 11 entity arrays and every action live in one context, one `useMemo`, one provider (`src/store/DataContext.tsx:70-374`). Any state change (e.g. one new `InventoryMovement`) re-renders every component that calls `useData()`, regardless of which slice it actually reads — there is no selector/slicing mechanism. At current mock-data scale (hundreds of records) this is invisible; it will not stay invisible once this becomes real, larger, server-backed data. Splitting by domain (or introducing a selector layer) is a pre-requisite for the backend-integration milestone, not an optional polish step, because the shape chosen here determines how painful the data-fetching swap is.
2. **Duplicated read of the same state inside a single action, via two different mechanisms.** `receivePurchaseOrder` (`src/store/DataContext.tsx:161-184`) and `returnLoanLines` (`213-245`) each call `setX(prev => ...)` (the correct, always-current pattern) to update the entity, and then **separately** read the outer `purchaseOrders`/`loans` closure variable to look up the same record again for movement-generation purposes. This happens to be safe today only because these actions are never invoked twice without a re-render in between; it is a fragile, easy-to-misuse pattern to copy into a new action. Should be unified into a single derivation per action.
3. **Two accepted-but-divergent form patterns** (`react-hook-form` + `zod` vs. plain `useState`, `PROJECT.md` §7 explicitly sanctions both "based on form complexity"). Reasonable as a pragmatic call for a prototype, but it means there are two idioms to learn, two places validation logic can live, and no shared convention for where the line is drawn. Worth a one-paragraph decision record before 2.0 scales past ~9 form dialogs.
4. **`LoanReturnRecord` type is defined but never constructed** (`types/index.ts:244-253`, acknowledged in `PROJECT.md` §9) — the Loan Returns page instead filters the movement log. Not urgent, but it's an example of the domain model documenting a shape the runtime doesn't honor, which will confuse anyone using the type file as ground truth (§9's own stated purpose for `types/index.ts`).
5. **No error boundaries anywhere in the tree.** A thrown render error in any page currently white-screens the whole app (confirmed: no `ErrorBoundary`/`componentDidCatch` usage anywhere in `src/`). Low cost to add now, high value once real (fallible) network calls exist.
6. **Single 1.3MB JS chunk on production build** (confirmed via `npm run build` output in `dist/assets/index-*.js`, ~1.3 MB) — `PROJECT.md` §9 already flags this; it's restated here because it's the most concrete, already-measured performance debt item and belongs early in any roadmap once route-level code-splitting is in scope.
7. **`ProductsPage`'s `highlight` URL param is set by `GlobalSearch` (`?highlight=<id>`) but never cleared** (`src/pages/products/ProductsPage.tsx:49,190`) — the ring-highlight persists in the URL after use. Cosmetic, cheap to fix, low priority.
8. **No environment/config layering.** Nothing distinguishes a dev vs. prod runtime beyond Vite's default `import.meta.env.MODE` — fine today with no backend to point at, but will need a real strategy the moment an API base URL exists.

---

## 8. Opportunities for Refactoring

Ordered roughly by leverage (impact vs. effort), not by roadmap sequence — see `DEVELOPMENT_PLAN.md` for sequencing and dependencies.

1. **Collapse the `*ById` static-lookup footgun (§6.1) into one rule, enforced structurally.** Either (a) stop exporting `*ById` helpers from `mocks/*.ts` entirely and require all lookups to go through `useData()` state (simplest, matches the codebase's own stated rule in `PROJECT.md` §11), or (b) keep them but rename/refactor so they visibly take the live array as a parameter (`productById(products, id)`) rather than closing over the seed data. Option (a) is recommended — the mock files should only be responsible for seeding, per their own doc comment intent.
2. **Move business-rule validation into `DataContext`'s actions themselves** (§6.2), even while still mock-backed. E.g. `adjustStock` should itself refuse an empty `reason`; `createLoan` should itself refuse a non-lab. This both closes the current gap and is exactly the shape a real backend's validation layer will need — writing it once now, mock-backed, de-risks the later swap.
3. **Introduce a real ID/sequence strategy** (§6.3) — at minimum a monotonically-increasing counter independent of array length, ideally isolated behind a small `idGenerator` module so it's one obvious place to swap for backend-assigned IDs later.
4. **Make `StatusBadge`'s config exhaustive at the type level** (§6.4) — a `satisfies Record<CaseStatus | LoanStatus | POStatus | Product['status'], ...>` (or equivalent per-status-type maps) turns a silent runtime fallback into a compile error.
5. **Split or slice `DataContext`** (§7.1) before backend integration, not after. Two reasonable shapes: (a) one context per bounded domain (Inventory/Products, Purchasing, Care/Cases-Patients-Labs, Commerce/Sales-Loans, System/Users-Settings) composed in `DataProvider`, or (b) keep one provider but expose granular selector hooks (`useProducts()`, `useLoans()`, ...) memoized independently so consumers don't all re-render together. Either removes the re-render-everything behavior and gives the future data-fetching layer (React Query or equivalent) a natural per-domain seam.
6. **Extract the mutation actions behind a small interface** (a `DataRepository`/`InventoryService` shape) that `DataContext` implements against its in-memory state today, so that swapping to network calls later means writing a second implementation of the same interface, not rewriting every page. This formalizes the strength already noted in §5.4/§9 rather than inventing something new.
7. **Add a lightweight test harness now**, even just for `DataContext`'s action functions (pure-enough logic, no DOM needed) — e.g. "does `createLoan` decrement stock and create a correctly-signed movement," "does `receivePurchaseOrder` correctly flip status at partial vs. full receipt." This is the highest-value, lowest-effort testing investment available given §6.5, because it directly protects the "inventory accuracy" principle the whole product is built around (`PROJECT.md` §2).

---

## 9. Recommended Project Structure Going Forward

The existing structure (§2) should be **kept, not replaced** — its module-mirrors-route consistency is a real asset (§5.1). The recommended evolution is additive:

```
src/
├── types/                  # (unchanged) — consider splitting index.ts into per-domain files
│                              re-exported from an index, once it grows past ~300 lines
├── content/                 # (unchanged)
├── mocks/                   # (unchanged) — seeding ONLY; *ById helpers removed or made
│                              explicitly parameterized (§8.1); this becomes the
│                              "fixtures" layer for tests too
├── services/                # NEW — the interface described in §8.6: one file per domain
│   ├── inventoryService.ts    (adjustStock, addProduct, addMovement, ...)
│   ├── purchasingService.ts   (createPurchaseOrder, receivePurchaseOrder, ...)
│   ├── loanService.ts         (createLoan, returnLoanLines, ...)
│   └── ...
│                              Each exports the SAME function signatures DataContext
│                              exposes today. Mock-backed now; swappable to
│                              fetch/TanStack-Query-backed later without touching pages.
├── store/
│   └── DataContext.tsx      # Thinner: seeds state, wires services, exposes useData()
│                              (or split into per-domain contexts, per §8.5)
├── components/               # (unchanged shape: ui/, shared/, layout/, theme/, <module>/)
├── layouts/                  # (unchanged)
├── pages/<module>/            # (unchanged)
├── lib/                       # (unchanged)
├── test/                      # NEW — colocated *.test.ts next to services/ is also fine;
│                                a top-level folder only if integration/e2e tests are added
├── App.tsx                    # Route table — candidate for React.lazy() per route (§7.6)
└── main.tsx
```

The only structural addition being recommended is a `services/` seam between `store/` and `mocks/` — everything else is the current structure, hardened. This keeps the refactor honest to the brief ("we are not rebuilding from scratch") while giving the codebase the one seam it's currently missing for the MVP/backend milestone.
