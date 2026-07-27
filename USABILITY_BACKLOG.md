# Desktop Experience & Usability Audit

> Running backlog for ImplantDesk's "feel like desktop software, not a website" principle (`PROJECT.md` §2, principle 8). Items here need a **coordinated, consistent change across multiple screens** — implement them once they can be done everywhere they apply, not piecemeal on one page. A friction fix that's local to one screen and low-risk should just be fixed directly when found (and noted in the relevant commit/report), not logged here.

---

## Open items

### 1. List → detail navigation loses filter/scroll/selection context
**Screens affected:** Cases, Labs, Patients, Purchase Orders (all navigate to a separate route for their detail view; each list page's search/filter state is local `useState`, which resets when the page unmounts on navigation and remounts on "Back").

**The one exception that already gets this right:** Products uses a `Sheet` (`ProductDetailSheet`) that overlays the list instead of navigating away — the list never unmounts, so its scroll position, search text, and filters survive opening and closing a product's detail view automatically, for free.

**Options to evaluate when this is picked up:** (a) standardize on the Sheet pattern for all detail views where the record doesn't need its own deep-linkable URL — but Cases/Labs/Patients/POs all currently have shareable routes (`/cases/:id` etc.), which the Sheet pattern doesn't provide; (b) keep routes but persist each list's filters in the URL query string, so browser back/forward restores them; (c) keep routes but lift filter state up (or cache it) so it survives unmount/remount. Needs a decision before implementing — don't fix one screen ahead of the others, or the inconsistency just moves rather than resolves.

### 2. No bulk operations anywhere
No list page (Products, Patients, Cases, Purchase Orders, Loans, Sales, Vendors, Labs, Users) supports multi-select — no row checkboxes, no "select all," no bulk status change / export / etc. Partly blocked on edit/delete flows not existing yet at all (`ARCHITECTURE.md` §9, `DEVELOPMENT_PLAN.md` M11) — bulk operations on records you can't yet edit/delete individually would be a smaller win. Worth revisiting once M11 (Edit/Delete flows) lands, so the bulk-action pattern is designed once and applied to every list page consistently rather than invented per-page.

### 3. No command-driven action layer beyond record search
`⌘K` (`GlobalSearch`) finds and navigates to existing Products/Patients/Cases/Labs — it doesn't expose *actions* ("New Product", "New Purchase Order", "New Case"...), which today only live in the Topbar's "+New" dropdown menu (mouse-only, one extra click to open). A VS Code/Figma-style command palette that combines "find a record" and "run a command" in one `⌘K` surface would cut a click for every creation flow and match the desktop-app pattern directly. Needs a single consistent design (one palette, one set of registered commands) rather than adding shortcuts ad hoc per page.

### 4. No sticky search/filter bar on long list pages
Every list page's search/filter row scrolls away with the table content (`AppLayout`'s `<main>` is the single scroll container; nothing pins the filter row). On pages with long tables (Products in table view, Inventory's movement history), a user who's scrolled down has to scroll back up to change a filter. Fixing this is a small, uniform CSS change (`sticky top-0` + a background so content doesn't show through) — worth doing as one pass across all list pages at once so every page gains the same behavior, rather than making one page sticky and leaving the rest inconsistent.

### 5. Detail-view pattern isn't consistently one thing
Related to #1: the app currently has two legitimate-looking but different answers to "how do I show a record's details" — a routed full page (Cases/Labs/Patients/Purchase Orders) vs. an overlay Sheet (Products). Both are reasonable patterns used by real desktop/web apps, but having both without a stated rule for which to use when is the kind of inconsistency principle 8 calls out. Worth an explicit decision (e.g. "Sheet for records without their own shareable deep link value; routed page for records worth deep-linking or sharing externally, like a Purchase Order's WhatsApp/print export") rather than defaulting case-by-case.

---

## Resolved / already addressed

- **Confirmation-dialog keyboard speed** — fixed directly in the shared `ConfirmDialog` component (`src/components/ui/confirm-dialog.tsx`) rather than backlogged, since it's already the one component every confirmation in the app uses: the primary action button now autofocuses on open, so pressing Enter immediately confirms without a mouse click, cutting cursor travel for the fast/common case. Applied automatically everywhere `ConfirmDialog` is used (currently: Purchase Order Submit/Confirm/Cancel), no per-screen change needed. See commit history for details.
