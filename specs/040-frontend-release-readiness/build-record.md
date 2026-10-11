# specs/040 — Build record (T001/T002)

## The release commit

- Tree: clean apart from the phase's own artifacts (`specs/040-…`
  untracked; the stray time-stamped debug dumps remain untracked and
  never ship).
- Commit at first build: `df48c5f chore(autopilot): state.json records
  phase 19 (specs/039) done…` on `main` (the phase 19 checkpoint,
  pushed to origin). The phase's own commits follow.

## FR-01 — the build, from a clean tree

- Command: `npm run build` (`tsc -b && vite build`).
- Exit: 0. Time: 2.56 s (this capture; 2.66–2.9 s across the phase 19
  window).
- **Warning ledger: ZERO warnings** (grep for warn/⚠ over the full
  build log returns nothing). Nothing to fix, nothing to record-with-
  reason beyond this line. tsc -b emitted no diagnostics.

## FR-02 — the per-route-chunk budget re-read (informational sizes; hard chunk-class fact)

The 038 posture holds verbatim: sizes are informational; the HARD budget
fact is chunk-class membership, enforced by
`tests/unit/bundleSplit.test.ts` reading `dist/.vite/manifest.json`
(green in this phase's verify runs — customer chunks reach no staff-only
markers, staff/admin chunks reach no customer-tenant markers).

| Asset (top of the manifest's entry list) | Raw | Gzip |
|---|---|---|
| `index-BCdMDntd.js` (the shell) | 305.70 kB | 95.84 kB |
| `supabase-B1C7OZ2c.js` | 215.74 kB | 55.58 kB |
| `CustomerMenuPage-*.js` | 19.92 kB | 6.24 kB |
| `MenuPage-*.js` | 22.48 kB | 5.78 kB |
| `ManageRestaurantPage-*.js` | 31.97 kB | 11.47 kB |

- Route-chunk count from the manifest: **25 `src/routes` entry chunks**
  (the 038 record counted 49 files total across entry/vendor chunks —
  unchanged in kind; each page remains its own lazy chunk).
- Verdict: **no budget drift** — the 038 measured result re-reads
  identical in class and magnitude; B1–B8 statuses stand.
