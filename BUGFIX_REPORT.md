# BUGFIX_REPORT.md — Patient Date-of-Birth Crash

## Bug

Creating a patient with no Date of Birth crashed `PatientProfilePage` (blank screen, no recovery — the app has no error boundary anywhere). Found incidentally while testing Phase 2 Milestone M5; confirmed pre-existing in ImplantDesk 1.8, unrelated to any Phase 1/2 change.

**Root cause:** `Patient.dob` is a required, non-optional `string` in the data model (`src/types/index.ts`), but `PatientFormDialog.tsx` only validated `firstName`/`lastName` before calling `addPatient`. An empty `dob` reached `PatientProfilePage.tsx`, where `new Date(patient.dob).getTime()` on an empty string produces `Invalid Date`/`NaN`, and something downstream in the render path threw.

## Fix

Since the data model already requires `dob`, the correct fix is to make the form actually enforce that — not to make the profile page tolerate an invalid state the data model says shouldn't exist. Added one check to `PatientFormDialog.tsx`'s existing validation block, mirroring the pattern already used for first/last name:

```diff
     if (!form.firstName.trim() || !form.lastName.trim()) {
       toast.error('First and last name are required.')
       return
     }
+    if (!form.dob) {
+      toast.error('Date of birth is required.')
+      return
+    }
```

One file, 4 lines. No changes to `PatientProfilePage.tsx` or anywhere else — this is the only path in the app that creates a `Patient`, so closing it at the source fully eliminates the crash.

## Verification

- `tsc -b --noEmit`: clean
- `npm test`: 19/19 (unchanged — no test exercises this UI-level validation, which is consistent with the rest of this codebase's existing pattern of only unit-testing `DataContext`'s actions, not dialog-level UI validation)
- `npm run lint`: 0 errors, 4 pre-existing warnings from this repo's own files (unchanged from Phase 2 baseline). Lint additionally reported 2 of the same pre-existing warnings from a sibling background-task worktree nested on disk at `.claude/worktrees/busy-allen-561c36` — confirmed via `git status` that this worktree is outside this repo's tracked tree; not this repo's code and not touched.
- `npm run build`: succeeds, ~1.3MB chunk (unchanged)
- **Live in-browser verification:**
  1. Reproduced the original crash scenario exactly (first/last name filled, DOB left empty, submit) — confirmed **no longer crashes**: a toast error appears, the dialog stays open, no navigation occurs, patient count stays at 40, zero console errors.
  2. Confirmed the valid path is unaffected: filled in DOB, submitted — patient created correctly (`PT-01041 · 41 yrs · Female · DOB Mar 20, 1985`), profile page rendered fully, zero console errors.
