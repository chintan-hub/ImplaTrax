# Desktop Experience & Usability Audit

> **Design goal** (not "looking modern" — this is the actual target): make every repetitive task feel effortless and extremely fast. Design for a user processing hundreds of records a day, not an occasional visitor. Every repeated workflow should get *faster* with experience — fewer clicks, less mouse travel, less scrolling, no lost context. Think Windows Explorer, Microsoft Office, VS Code, Figma — not a typical CRUD web app.
>
> **Full principle set** (`PROJECT.md` §2, principle 8 — permanent, applies app-wide):
> - Reduce clicks, mouse movement, and scrolling wherever possible.
> - Keep user context whenever navigating (scroll position, filters, selection).
> - Keep search/filter/action bars sticky on long pages.
> - Frequently used actions stay accessible — never buried.
> - Support efficient bulk operations everywhere they make sense, including desktop-style multi-select: drag/rubber-band selection, click-and-drag continuous selection, auto-scroll while dragging, Shift-click range selection, Ctrl/Cmd multi-selection.
> - Preserve selections after edits whenever practical.
> - Avoid unnecessary page transitions — prefer drawers, sheets, or inline editing where appropriate.
> - Keyboard shortcuts are first-class, not an afterthought.
> - When an idea needs a larger coordinated change, build the reusable component/infrastructure once, then adopt it gradually — never one-off per screen.
>
> **How this backlog works:** an item here needs a **consistent, cross-app pattern** before it's implemented anywhere — that's what makes it backlog material instead of a same-day fix. A friction fix that's local to one screen and low-risk should just be fixed directly when encountered (standing permission granted — business logic/data integrity must be preserved), noted in the relevant commit, not logged here. Items are ranked by impact: how much daily friction they remove, how many screens/workflows they touch, and how well they set up later items.

---

## P0 — Highest impact, foundational (do first; later items build on these)

### 1. Sticky search/filter/action bars on every list page
**Why P0:** Every single list page (Products, Inventory, Purchase Orders, Patients, Cases, Labs, Vendors, Sales, Loans, Users) has this exact same gap — highest screen coverage of any item here, and it's the cheapest to fix once built as one shared pattern (a layout primitive, not per-page logic). Currently every list page's search/filter row scrolls away with the table content (`AppLayout`'s `<main>` is the sole scroll container). On a long table (Products, Inventory's movement history) that means scrolling back up just to change a filter — the opposite of "frequently used actions stay accessible."

**Shape of the fix:** one reusable sticky-toolbar treatment (`sticky top-0` + solid background + a shadow/border once stuck) applied uniformly via a shared layout piece — not copy-pasted per page.

### 2. List → detail context preservation
**Why P0:** Second-highest screen coverage (Cases, Labs, Patients, Purchase Orders all navigate to a separate route for detail; each list's search/filter/scroll state is local `useState`, reset on unmount). This is exactly "keep user context whenever navigating," and it's hit constantly — browse a list, open a record, come back, and every filter you had is gone. **Products already solves this for free**: `ProductDetailSheet` is an overlay `Sheet`, not a route, so the list never unmounts.

**Shape of the fix:** needs one explicit decision, not four different patches (see item 6). Once decided, apply it to all four screens in the same pass.

### 3. Bulk selection with desktop-style multi-select
**Why P0:** The most explicitly detailed ask in the principle set (drag/rubber-band selection, click-and-drag continuous selection, auto-scroll while dragging, Shift-click range, Ctrl/Cmd multi-select) — this is the single biggest lever for "processing hundreds of records" and the clearest "Explorer/Office, not CRUD web app" signal. No list page currently supports selecting more than one row.

**Shape of the fix:** build one reusable selection primitive (a hook/behavior, e.g. `useRowSelection` + a rubber-band overlay component) once against a real table (Products or Purchase Orders, both already `TanStack Table`-friendly), including keyboard modifiers (Shift/Ctrl range and toggle) and auto-scroll-on-drag, then roll it out to every list page's table. Needs at least one real bulk *action* to pair with it to be useful (bulk status change, bulk export) — sequence this after Edit/Delete flows (Phase 4, M11) exist, since bulk-editing records you can't yet edit individually is a smaller win. **Preserve selection after edits** (explicit principle) is a property of this same primitive, not a separate feature — design it in from the start, don't bolt it on later.

---

## P1 — High impact, more contained

### 4. Keyboard shortcuts as a first-class, app-wide layer
**Why P1:** Currently only `⌘K`/`Ctrl+K` (global search) exists. A consistent shortcut layer (e.g. `n` for new-record-on-this-page, `Esc` consistently closes/back, arrow-key row navigation in tables, `Enter` to open the focused row) removes mouse trips on the most repeated actions. Already has a real head start: Phase 3's `ConfirmDialog` autofocus fix means every confirm dialog is already one `Enter` away from done — this item is about extending that same "keyboard gets you there fast" habit to navigation and row-level actions, not inventing a new concept.

**Shape of the fix:** one shortcut-registration hook/provider (scoped per page or global) so shortcuts are declared consistently, not `addEventListener`'d ad hoc per component like the current `⌘K` handler in `AppLayout.tsx`.

### 5. Command palette gains actions, not just record search
**Why P1:** `⌘K` already finds Products/Patients/Cases/Labs and navigates to them — extending it to also run actions ("New Product", "New Purchase Order", currently mouse-only via the Topbar "+New" dropdown) is a natural, incremental extension of an existing, working surface rather than new infrastructure. Pairs naturally with item 4.

### 6. One explicit rule for "how do I show a record's detail view"
**Why P1:** Directly resolves item 2's open question, using the principle set's own guidance ("avoid unnecessary page transitions — prefer drawers, sheets, or inline editing where appropriate"). Proposed rule, to confirm once and then apply everywhere: **default to a Sheet/drawer overlay** (matching `ProductDetailSheet`) for any record detail view that doesn't need its own shareable deep link; **keep a routed page** only where a record's detail view is meant to be linked to directly or is itself a hub for sub-navigation (e.g. Purchase Orders' detail page is linked from WhatsApp/print exports — a real reason to keep a URL). Once decided, migrate Cases/Labs/Patients to match, in one coordinated pass rather than case-by-case.

---

## P2 — Valuable, sequence after the above

### 7. Efficient bulk operations on top of selection
Once item 3 (selection) and Edit/Delete flows (Phase 4, M11) both exist: bulk status change, bulk export, bulk assign — the actual payoff of building the selection primitive. Don't build the action layer before the selection primitive it depends on.

### 8. Inline editing where it removes a whole navigation round-trip
E.g. adjusting a single product's low-stock threshold or a purchase order line's quantity without opening a full dialog. Lower priority than the above because it's genuinely per-screen judgment (some fields are safe to inline-edit, others need the validation a dialog provides) rather than one reusable pattern — tackle opportunistically, screen by screen, as instructed, rather than as a dedicated project.

---

## Resolved / already addressed

- **Confirmation-dialog keyboard speed** — fixed directly in the shared `ConfirmDialog` component (`src/components/ui/confirm-dialog.tsx`): the primary action autofocuses on open (Enter confirms with no click), except destructive dialogs, which default focus to the safe option instead. Applies automatically everywhere `ConfirmDialog` is used. See commit history.
