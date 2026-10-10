# W1 — Bundle Baseline (FR-01, T001)

**Harness**: `npm run build` (vite 7, production) — output copied verbatim.
**Date**: 2026-10-10 · **Tree**: post-phase-17 (commit 4894ec8)

## Baseline (pre-split)

```text
dist/assets/index-BYpWYqBE.css   61.76 kB │ gzip:  10.49 kB
dist/assets/index-Cun7-CRp.js   794.24 kB │ gzip:  219.61 kB
✓ built in 2.25s
```

- ONE JS chunk serves every route (customer, staff, admin): **794.24 kB raw
  / 219.61 kB gzip**. `src/app/router.tsx` declares both shells with eager
  page imports — zero `React.lazy`, zero route-level splitting (research R1;
  measured directly, matches the phase-17 verify build 219.56→219.61 kB
  gzip — noise-level drift from the 037 finalization edits).
- The dev gallery is already dead-code-eliminated (routes.ts import
  contract) — nothing to claim there.
- CSS ships as one chunk as well (61.76 kB) — recorded, not in scope for
  splitting (vite code-split CSS per route needs per-route CSS modules;
  revisit only if a measurement demands).

## FR-09: 016 oracle re-measure (T008 slot — recorded here when run)

_(pending — W1 step 3)_

## Post-split measurement (T004 slot — recorded here when run)

_(pending)_
