# Phase 02 Validation

**Date:** 2026-09-27 · **Baseline:** `a707a27` · **Checkpoint:** `306c0ae`

## Final gates (phase order: db:reset → db → integration (quiet window) → build; E2E last)

| Gate | Command | Result | Evidence notes |
|---|---|---|---|
| Format | `npm run format:check` | PASS | all matched files |
| Lint | `npm run lint` | PASS | 0 errors; 3 pre-existing warnings (unchanged from Phase 01) |
| Typecheck | `npm run typecheck` | PASS | 0 errors |
| Unit | `npm run test:unit` | **PASS 349/349** | 26 files; +54 new (tokens 20, literals 4, ui contracts 34 minus overlap) |
| Database | `npm run test:db` | **PASS 516/516** | after `db:reset --yes` (D9 protocol); no schema changes this phase |
| Integration | `npm run test:integration` | **PASS 38/38 isolated** | parallel-run failures reproduce W1 exactly (findings F5); identity of failures rotates across runs; every suite green in targeted runs incl. auth.signin 23/23 and the 3 rotating files 8/8 |
| Build | `npm run build` | PASS | 722 kB JS (−? +14 kB vs Phase 01's 708; primitives + tokens), 4.09 kB CSS |
| Build grep | dist scan | **GALLERY-EXCLUDED** · tokens defined once | `Dev gallery`/`dev/gallery` absent from `dist/assets/*.js`; `--color-brand` definitions: 1 |
| E2E full | `npm run test:e2e` | 127 passed / 4 failed → diagnosed | all 4 = W1 class (findings F4/F7); the 4 suites re-ran together after fixture repair: 35/36, and management.surfaces **14/14 isolated**; the 36th is the Fiona-dashboard W1 signature |
| E2E phase | `npx playwright test e2e/design.system.test.ts` | **PASS 8/8** (chromium + mobile + tablet) | gallery smoke, interactions (dialog/tabs/toast), axe 0 violations ×3 projects, no horizontal overflow at 390/834 |
| Impeccable detect | `impeccable detect src` | **0 anti-patterns** | one real finding fixed (ProgressBar layout transition, findings F3) |
| Screenshots | gallery captures | committed | `specs/022-frontend-design-system/evidence/gallery-{desktop,mobile,tablet}.png` (1440/834/390, DPR 2, fullPage) |
| Visual review | live browser inspection | pass | buttons/fields/feedback/overlays/data/icons/totals/density sections reviewed against the direction contract |

## Contrast contract (FR-06, Q6)

`tests/unit/design.tokens.test.ts` parses tokens.css and asserts every
declared pair: 11 text pairs ≥ 4.5:1 + 3 UI pairs ≥ 3:1 (focus ring,
border-strong). Measured values recorded in the test output; failures fail
the build. Pairs: ink/surface, ink/raised, muted/raised, muted/surface,
brand/raised, on-brand/brand, on-danger/danger, positive/positive-surface,
warning/warning-surface, danger/danger-surface, info/info-surface;
focus-ring/surface, focus-ring/raised, border-strong/raised.

## Accessibility (FR-06)

- axe WCAG 2.2 AA automatable subset on the gallery: **0 violations** on
  chromium, mobile-chromium (390×844), tablet-chromium (834×1112).
- Focus-visible ring token on every interactive primitive; roving tabindex
  tabs; dialog focus trap (native) + drawer trap/restore; Esc closes both.
- Reduced motion: global neutralization (base.css) + per-primitive
  spinners/skeletons.
- Live regions: danger/warning alerts assertive, info/success/toasts polite;
  per-field errors announced and attached (Field `role="alert"`).

## Presentation contracts (ledger, FR constraints)

- No existing accessible name/label/heading changed: primitives are new
  leaves; the only touched existing file rendering UI is the DEV-only
  gallery (`route.titles` asserts its H1 — kept `Dev gallery`).
- Frozen storage keys untouched; no new `data-testid` in product surfaces.
- `routeRegistry`/`RouteTitles` architecture untouched (gallery entry still
  lives in router.tsx behind `import.meta.env.DEV`).

## W1 / environmental (carried, not absorbed)

- Integration parallel failures: W1 signature, all suites pass isolated.
- E2E full-suite: 4 failures = F4 password poisoning (diagnosed live,
  repaired via the app's own flow) + Fiona-dashboard ordering signature.
- Auth 429: one window; D9 quiet-window protocol applied.

## Verification of the phase's own exit criteria (Master Plan §8 Phase 02)

- PRODUCT.md + DESIGN.md exist and are committed ✅
- Every §5.3 primitive exists with states + gallery entry ✅ (creation rule
  applied; each primitive names its first consumer)
- Tokens are the only color/spacing source (unit-enforced) ✅
- Unit contract tests pass ✅ · axe + console checks pass on the gallery ✅
- Screenshots archived ✅ · conventions doc updated (consume + amend) ✅
