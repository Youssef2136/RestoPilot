# specs/040 — Research (Frontend Production Readiness & Release)

## research.md

- **R1 — The standing deploy contract (verbatim re-read)**:
  `scripts/deploy-frontend.mjs` requires exactly `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT` (each named when
  missing); `--dry-run` validates the bundle precondition
  (`dist/index.html` at the deploy root) and prints the manifest; the
  real deploy once validated is NOT exercised by the repository (no
  credentials in this environment — the owner's action).
- **R2 — The build/budget standing facts**: `npm run build` = `tsc -b &&
  vite build`; `build.manifest: true` feeding
  `tests/unit/bundleSplit.test.ts` (chunk-class membership = the hard
  budget fact; sizes informational per 038); the 038 measured result
  index 305.70 kB / 95.84 gzip + 49 per-page chunks is the baseline to
  re-read, not re-litigate.
- **R3 — The guard suite**: `tests/unit/production.guard.test.ts`
  (no non-`VITE_` variable reaches the bundle; `.env` git-ignored; the
  environment inventory drift tripwire vs `.env.example` + the runbook
  table). It runs inside `npm run verify` today (unit tier).
- **R4 — SPA fallback**: Cloudflare Pages' built-in SPA behavior; the
  deploy script verifies `dist/index.html` at the deploy root; Vite
  history-mode routing needs no app change. The BUILT-artifact proof
  vehicle locally: `vite preview` serves `dist/` with an SPA fallback
  for unknown paths (Playwright visits the deep links directly).
- **R5 — The environment matrix**: `docs/production-runbook.md` §3
  already carries Local/Staging/Production rows; FR-04's job is the
  exact per-environment variable names in one table (the runbook §5
  inventory extended with per-environment placement).
- **R6 — Auth redirect URLs**: Supabase Dashboard → Auth → URL
  Configuration (Site URL + redirect allow-list) — the operator step;
  the runbook §4 item 3 records the concept; FR-06 records the exact
  production-domain step with its dashboard path.
- **R7 — Caching**: Cloudflare Pages serves hashed `assets/*` with
  long-lived immutable caching by default and `index.html` (the SPA
  fallback) with edge-revalidate semantics; the record names what the
  host provides by default and what would need configuration.
- **R8 — Error tracking posture**: vendor-free (clarified): the 037
  error boundary exposes the recovery view, never the raw message; the
  operator watches Supabase Logs & Analytics + the Pages deployment
  logs; wiring a client-side vendor later is a new spec (the runbook
  §4 item 13's recorded options stand).
- **R9 — Release regression scope**: the Phase 19 release suites
  (journey + roles, 10/10) re-run on the release commit (dev-mode
  regression record) + the NEW built-artifact smoke (US4) + the a11y
  floor on the preview build (FX floor via the standing matrix infra).
- **R10 — Rollback reality**: `npx wrangler pages deployment rollback`
  or the Pages dashboard (Deployments → previous → Rollback); what
  cannot be rolled back: database migrations (forward-fix), the
  Supabase auth/config changes, and any data mutation the bad build
  caused.
