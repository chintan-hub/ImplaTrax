# PHASE3_REPORT.md — Purchase Order Production Workflow

> Commit: `58cba0a`. Builds the Purchase Order module out to production-ready per the brief: business rules, full status workflow, confirmation dialogs, complete audit history, and an architecture prepared for (but not fully implementing) WhatsApp/PDF/Print/Photo. No other module was touched; no existing UI was redesigned.

---

## Business rules — verified, not just implemented

**"A Purchase Order does NOT change inventory. Inventory only increases when Stock Received is completed."**
This was already true in the pre-existing code (`createPurchaseOrder`/`submitPurchaseOrder`/`confirmPurchaseOrder`/`cancelPurchaseOrder` never call `applyQtyDelta`; only `receivePurchaseOrder` does). It's now also stated explicitly in a code comment at the top of the PO action block in `DataContext.tsx`, and confirmed live in the browser: creating, submitting, and confirming a PO left the Inventory page's movement log and the product's `quantityOnHand` completely unchanged; only clicking "Receive" produced new `inbound` movements.

**"Every Purchase Order must have a timestamp-based ID in the format YYYYMMDDHHmm."**
Implemented as the `poNumber` field (the human-facing identifier — the internal `id` field, never shown to users, was left as-is). `src/lib/idGenerator.ts` adds `formatTimestampId()` and `createTimestampIdGenerator()`. Two POs created in the same calendar minute would otherwise collide (the format has no seconds), so a second call for the same minute gets a `-2`, `-3`, ... suffix — the format holds exactly as specified in the overwhelmingly common case, and never silently collides in the rare one. This was validated for real, not just in theory: the 24-record mock seed generator produces enough same-minute POs that the birthday-paradox collision risk is real, and the suffix mechanism was observed firing correctly in the browser (e.g. `202606011251-2`).

---

## Status workflow

| Status | Reachable via | Guarded by |
|---|---|---|
| Draft | `createPurchaseOrder` | — (starting state) |
| Submitted | Submit button (+ confirmation dialog) | `canSubmitPO`: only from Draft |
| Confirmed | **New** Confirm button (+ confirmation dialog) | `canConfirmPO`: only from Submitted |
| Partially Received | Receive dialog, partial quantities | `canReceivePO`: from Submitted/Confirmed/Partially Received |
| Fully Received | Receive dialog, remaining quantities | same |
| Cancelled | Cancel button (+ confirmation dialog, unchanged from before) | `canCancelPO`: only from Draft/Submitted/Confirmed |

All four guard functions live in one new file, `src/lib/poWorkflow.ts`, and are used both by `DataContext` (to reject an illegal transition — e.g. `submitPurchaseOrder` now throws if the PO isn't a draft, `receivePurchaseOrder` now throws if the PO is still a draft) and by the UI (to decide which buttons to show). One source of truth, not two copies that could drift.

**A real gap this closed:** before this change, `submitPurchaseOrder` and `cancelPurchaseOrder` had **no guard at all** — either could be called on a PO in any status, including an already-received or already-cancelled one, silently corrupting its state. `confirmPurchaseOrder` didn't exist at all, even though `'confirmed'` has been a valid `POStatus` value since the type was first written — there was simply no way to reach it.

### A scope decision worth your explicit confirmation

The request listed five statuses to implement: **Draft, Confirmed, Partially Received, Fully Received, Cancelled** — it did not mention **Submitted**, which already existed in the codebase's `POStatus` type and had a working `submitPurchaseOrder` action and UI button before this phase started.

I kept `Submitted` rather than removing it, for two reasons: removing it would have been a breaking change to an already-working feature (contradicting "preserve the current design language" / "do not redesign"), and `PROJECT.md` documents the intended lifecycle as `draft → submitted → confirmed → partially-received / received`. I built Confirm as the next step *after* Submitted, not as a replacement for it — so the flow is Draft → Submit → Confirm → Receive.

**If you intended Draft to go directly to Confirmed (skipping Submitted entirely), that's a different, smaller change** — say so and I'll adjust `canConfirmPO` to also accept a draft PO, and decide whether to hide the Submit button. I didn't make that judgment call unilaterally since it changes an existing, working part of the app.

---

## Confirmation dialogs

Every status-advancing action now has one, reusing the app's existing `ConfirmDialog` component (no new dialog component was built — this *is* preserving the design language, literally reusing the same one Cancel already used):

- **Submit** → "Submit {PO} to vendor?" (new — previously this was an immediate, un-confirmed action)
- **Confirm** → "Mark {PO} as confirmed?" (new)
- **Cancel** → unchanged, already existed
- **Receive** → the existing `POReceiveDialog` (explicit per-line quantity entry + a "Confirm Receipt" button) already functions as its own confirmation step; it was left as-is rather than wrapping it in a second, redundant dialog.

---

## Audit history

`PurchaseOrder.history: PurchaseOrderEvent[]` — a new field, append-only, stored directly on the `PurchaseOrder` record itself (deliberately **not** a separate `Record<poId, event[]>` map, which is exactly the pattern that caused the stale-lookup bug fixed in Phase 2's M3 — putting history on the record itself means it can never drift out of sync with the record it describes).

Every transition appends one entry — created, submitted, confirmed, partially received, fully received, cancelled, photo attached/removed — with a label, a plain-English description, a timestamp, and the acting user's name. Nothing is ever edited or removed; a regression test (`'seeds a one-entry audit history on creation, and every transition appends to it (never replaces it)'`) asserts this directly. It's rendered on the new PO Detail page as a timeline, using the identical visual pattern already established on `CaseDetailPage`.

The 24 seed Purchase Orders were also given synthesized, chronologically-consistent histories (`createdAt → submittedAt → confirmedAt → receivedAt`, each date capped at "now" so nothing lands in the future) so the new History section isn't empty for existing demo data — verified live in the browser that a fully-received seed PO shows a correctly-ordered chain (Created → Submitted → Confirmed → Fully received).

---

## New architecture

| File | Purpose |
|---|---|
| `src/lib/poWorkflow.ts` | `canSubmitPO` / `canConfirmPO` / `canReceivePO` / `canCancelPO` — single source of truth for legal status transitions |
| `src/lib/poShare.ts` | `buildPOSummaryText()` — one shared text-summary builder, used by WhatsApp today and intended for Print/PDF to reuse later, so those don't each reassemble PO content independently |
| `src/lib/idGenerator.ts` (extended) | `formatTimestampId()`, `createTimestampIdGenerator()` |
| `src/components/purchase-orders/POStatusActions.tsx` (new) | The one place status-action buttons + their confirmation dialogs live, used by both the list page and the detail page |
| `src/pages/purchase-orders/PODetailPage.tsx` (new) | Route `/purchase-orders/:poId` — line items, history timeline, vendor/dates, Share & Export |

`PurchaseOrdersPage.tsx` was simplified, not expanded: its ~50 lines of inline `canSubmit`/`canReceive`/`canCancel` button logic were replaced with a single `<POStatusActions po={po} size="sm" />`, and rows now navigate to the detail page (matching how `ProductsPage`/`CasesPage` rows already behave).

---

## "Prepare, don't fully build" — WhatsApp / PDF / Print / Photo

The brief said not to fully implement these unless already simple. Assessment per item, and what shipped:

| Feature | Status | Why |
|---|---|---|
| **Copy WhatsApp Message** | **Working** | One `navigator.clipboard.writeText()` call on a pre-built text summary — no new dependency, genuinely trivial. Verified live: clipboard write succeeds, success toast shown. |
| **Print** | **Working** | One `window.print()` call — a native browser API, no new dependency, no custom print CSS was added (that would have been the "fully implement" version). Code-reviewed and wired correctly; not click-tested live since it opens a native OS dialog the automated browser can't interact with. |
| **Generate PDF** | **Not implemented** — disabled button, "coming soon" | Genuinely requires either a new dependency (e.g. jsPDF) or significant layout work — this is the one that crosses the line from "prepare" into "fully build." `buildPOSummaryText()` already exists as the seam it would consume. |
| **Optional attached photo** | **Working** | File input → `FileReader` → data URL stored on `PurchaseOrder.photoDataUrl`, with a 5MB size guard and a working remove action. Simple enough (no dependency, ~30 lines) to finish rather than stub — the brief's "unless already simple" exception. Verified live end-to-end (attach → thumbnail renders → history entry → remove → history entry). |

All four share the same `PurchaseOrder` fields / `poShare.ts` builder, so wiring PDF generation later is additive, not a rework.

---

## Files changed

**New:**
- `src/lib/poWorkflow.ts`
- `src/lib/poShare.ts`
- `src/components/purchase-orders/POStatusActions.tsx`
- `src/pages/purchase-orders/PODetailPage.tsx`

**Modified:**
- `src/types/index.ts` — `PurchaseOrderEvent` type; `PurchaseOrder` gains `history`, `photoDataUrl?`, `confirmedAt?`
- `src/store/DataContext.tsx` — timestamp ID generator, `confirmPurchaseOrder` (new), `attachPhotoToOrder` (new), status guards added to `submitPurchaseOrder`/`receivePurchaseOrder`/`cancelPurchaseOrder`, history appended by every PO action
- `src/store/DataContext.test.tsx` — 3 existing tests updated (see below), 8 new tests added
- `src/mocks/purchaseOrders.ts` — timestamp IDs, chronologically-chained dates, synthesized history
- `src/lib/idGenerator.ts` — `formatTimestampId`, `createTimestampIdGenerator`
- `src/pages/purchase-orders/PurchaseOrdersPage.tsx` — uses `POStatusActions`, rows navigate to detail page
- `src/App.tsx` — new route
- `src/content/helpText.ts` — `ICON_HELP` entries for the new Confirm/WhatsApp/Print/PDF/Photo actions

---

## Verification

### TypeScript
`npx tsc -b --noEmit` — clean.

### Tests
```
npm test
 Test Files  1 passed (1)
      Tests  27 passed (27)
```
19 pre-existing (12 from Phase 1, 7 from Phase 2's M4) + **8 new**, covering:
- Timestamp-ID format and the no-inventory-change rule on creation
- Audit history is append-only across multiple transitions (never replaced)
- `confirmPurchaseOrder` only allows submitted → confirmed (rejects from draft, rejects double-confirm)
- `submitPurchaseOrder` only allows draft → submitted (rejects double-submit)
- `receivePurchaseOrder` rejects a draft PO
- `cancelPurchaseOrder` rejects a PO that's already been received
- Partial vs. full receipt produce the correct distinct history event labels
- `attachPhotoToOrder` sets/clears `photoDataUrl` and logs both directions

**3 pre-existing tests required updating** — not a regression, a consequence of a real bug fix. Before this phase, `receivePurchaseOrder` had no status guard, so three Phase-1/2 tests called it directly on a freshly-created (still-draft) PO — legal under the old code, correctly rejected by the new `canReceivePO` guard. Updated each to `submitPurchaseOrder` first, matching the real, correct workflow.

### Lint
`npx eslint src` (scoped to this repo's own files — an unrelated background task's sibling worktree at `.claude/worktrees/busy-allen-561c36` sits nested on disk and gets picked up by an unscoped `eslint .`, which is noise, not this repo's code) — **0 errors, 4 pre-existing warnings**, unchanged from the Phase 2 baseline.

### Build
`npm run build` — succeeds. Bundle grew from ~1,297KB to ~1,312KB (+~15KB, expected for one new page + component + two new lib modules).

### Browser (manual, full walkthrough)
- List page: new timestamp-format PO numbers render correctly; row click navigates to detail page; inline `POStatusActions` render correctly per status.
- Detail page: Line Items table, History timeline, Vendor & Dates card, Share & Export card all render correctly, in both light and dark mode.
- Full lifecycle exercised end-to-end on a real draft PO: **Submit → Confirm → partial Receive (10/26) → full Receive (remaining 16 + 8)** — each transition's confirmation dialog appeared, each status badge updated correctly, and the **Inventory page's movement log was checked and confirmed** the two `inbound` movements were created with the correct quantities and this PO's new `poNumber` as their reference.
- Cancel tested separately (list-page inline action) — destructive-tone confirmation dialog, correct final state, no further actions available on a cancelled PO.
- Created a brand-new PO via the form dialog — got a live timestamp ID, appeared in the list, no inventory movement was created (business rule confirmed for a live, non-seed record too).
- WhatsApp copy: clipboard write succeeded (success toast shown; read-back blocked by the sandboxed browser's clipboard-read permission, which is expected and unrelated to the app).
- Photo attach/remove: simulated a file selection (no native file-picker automation available in this browser surface) — thumbnail rendered, history entries recorded correctly for both attach and remove.
- Zero console errors across the entire walkthrough.

---

## Remaining issues / open questions

1. **The Submitted-status scope decision above** needs your explicit confirmation — I kept it; say if you wanted it removed.
2. **Generate PDF** is intentionally unbuilt (disabled button) — confirm this matches your expectation before Phase 4, or let me know if it should be prioritized sooner.
3. Nothing else from this phase is outstanding. `PHASE1_REPORT.md` / `PHASE2_REPORT.md`'s previously-flagged items (npm audit findings, the patient-DOB crash — now fixed separately) are unrelated to this phase and unchanged.

---

Waiting for your approval before continuing.
