# specs/038 — Data Model (frontend-only phase)

No backend/RPC/database changes (016 owns the backend). This phase's
"entities" are measurement artifacts and runtime code structures:

## Measurement artifacts (in the feature directory)

- `measurements/W1-baseline.md` … `W5-realtime-cache.md` — each section is a
  **Baseline → Change → Measurement → Result** record: baseline value +
  harness + profile; the change named exactly; the re-run measurement; the
  honest result (including "no change needed" and "worse, reverted").
- `cache-policy.md` — the FR-04 table: query family → keys → freshness
  expectation (fresh / staleTime pause / poll interval / realtime
  invalidation) → retry policy → identity/scope-in-key note.
- `budgets.md` — the FR-08 record: each budget, its threshold, its
  justification (baseline context), and its measured result.

## Runtime structures

- **Route chunk classes** (FR-02): `customer` (public + in-session pages)
  vs `staff` (dashboard/staff areas) vs `admin` — defined by the router's
  shell-group boundaries; enforced by the build-output assertion.
- **`lazy-pages` registry** (D2): a module mapping route literals to
  `React.lazy` page importers — declared OUTSIDE the E2E-imported modules
  (`routes.ts` stays define-free and statically analyzable).
- **Suspense fallback** (chunk loading state): the 037 Skeleton at the
  shell boundary; the failure path = the existing route error boundary.
- **Memo boundaries** (FR-06, only if measured): `memo`-wrapped row/card
  components on the live boards; NO virtualization until D7's probes demand
  one, and then a dedicated primitive with the 035 a11y baseline intact.
- **Image helper** (FR-03, only if the inventory demands): a single shared
  component wrapping `loading="lazy"`, `decoding="async"`, the 02
  aspect-box classes, and the placeholder → loaded → failed states through
  the 037 vocabulary; keyboard/AT unaffected (no focusable content inside).

## Invariants

- Cache keys keep carrying identity/scope exactly as today (no new
  cross-identity caching; no persistent business-data caches beyond the
  existing react-query conventions).
- No browser-storage business-data caching is introduced.
- Prefetch touches only surfaces the signed-in identity may already read.
