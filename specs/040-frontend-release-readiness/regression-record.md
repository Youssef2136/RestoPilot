# specs/040 — Regression record (FR-11 + the final gate window)

## The release-commit regression (T013, dev-mode, the phase 19 suites re-run)

- `db:reset -- --yes` → the SEVEN release files together, chromium,
  workers 1, line reporter:
  **10/10 passed (2.2 m)** — release.journey 4 + six role files 6.
- Honest ledger: the kitchen role file initially hit the config's 30 s
  default on its long serial leg (it predates the journey's explicit
  timeouts); fixed by the same `testInfo.setTimeout(180_000)` posture
  the release journey uses — the assertion's own bounds (15 s waits)
  were never weakened. Re-run green.

## The standing a11y floor re-run (T014)

- `e2e/a11y.matrix.test.ts` — **31/31 passed (3.9 m)**: every registered
  route scanned in its authorized state, the shell floor asserted per
  page, findings outside the committed baseline fail.

## The built-artifact proof (US4 — these ran against `vite preview`, NOT the dev server)

- `e2e/production.smoke.test.ts` — **3/3 passed (38.0 s)** after
  `db:reset`, serving `dist/` (68 files, the deploy manifest exactly):
  1. the five deep-link classes cold-load (FR-05: /r/:slug with the
     progressive Branch→Table form; /r/:slug/menu entered honestly; the
     fresh-browser gate after the session is cleared; /dashboard and
     /admin redirect to /signin);
  2. the state matrix in the built app: the not-found entry refusal
     ("Restaurant not found" — the honest refusal view), the offline
     banner lifecycle ("You're offline" → recovers), console clean;
  3. a REAL ordering round end-to-end with carla's card accept in
     realtime, the injected accept_round refusal rendering VERBATIM at
     the card, the explicit retry landing it, console clean.

## Cross-browser record (FR-11)

- **Chromium** is the primary and only exercised engine (the standing
  clarified posture since spec 036 — the risk is layout, not engine
  semantics; the standing batch protocol and the cloud rate limits stay
  valid). **WebKit is NOT exercised and this is the recorded posture,
  not a silent absence** — bringing up a second engine is a future
  option to record, not this release's work.
- Device classes re-proven standing (036's 26-route device contract +
  the phase 19 responsive family — unchanged this phase: `git status`
  touches no src/** layout file; the proof is the suites above running
  green on the release commit).

## The final gate window (T016)

| Gate | Verdict |
|---|---|
| `npm run build` clean-tree warnings ledger | ✅ ZERO warnings (build-record.md) |
| `npm run verify` on the release commit | ✅ EXIT=0 (the full format/lint/typecheck/unit 454/454/db 516/516/integration 38/38/build 3.01 s pipeline; the honest ledger: the FIRST full verify attempt failed its db tier with 14 fixture-drift failures — the mandated db:reset → failed-tier rerun proved 516/516 green; then the integration tier failed 6 files — one real orphan row, an auth user the provisioning suite's interrupted earlier attempt left behind (removed, one row), plus the shared-cloud auth rate limiter's burst noise (the tier re-run green after cooling: 7/7 files); the final full-gate run EXIT=0. Recorded because deploy honesty includes the gate's path to green, not just its verdict.) |
| `npm run release:check` | ✅ GREEN — 16 deterministic gates (guard suite, bundle classes, budget re-read, artifacts' structure, dry-run) |
| `node scripts/deploy-frontend.mjs --dry-run` | ✅ exit 0 — 68-file manifest, SPA precondition met, the credential refusal named |
| `e2e/production.smoke.test.ts` vs `vite preview` | ✅ 3/3 (38.0 s) |
| Release suites (journey + 6 roles) | ✅ 10/10 (2.2 m) |
| a11y.matrix | ✅ 31/31 (3.9 m) |

## The FR-03 manual bundle inspection (recorded here, named in the checklist)

- Command: grep over all `dist/assets/*.js` for the secret-pattern set
  `service_role｜service-role｜SUPABASE_DB_URL｜sk_live｜pk_live｜
  webhook_secret｜CLOUDFLARE_API_TOKEN`.
- Result: **49 assets scanned, ZERO matches** — only the publishable key
  (public by design) reaches the bundle. The standing guard suite
  (production.guard.test.ts, green in every release:check run) asserts
  the structural rule; this inspection is its manual confirmation on
  the actual built bytes.
