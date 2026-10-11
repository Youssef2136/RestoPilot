# specs/040 — Deploy rehearsal (T003)

Command: `node scripts/deploy-frontend.mjs --dry-run` — exit 0, on the
release-commit tree (build from T001 still on disk; the script requires
that exact state).

## What the rehearsal printed

- `[deploy] bundle OK — 68 files, SPA fallback precondition met
  (dist/index.html at root)` — the FR-05 precondition verified
  mechanically by the contract itself.
- `[deploy] --dry-run: no credentials needed; this is exactly what a
  real deploy would upload:` — followed by the complete 68-file upload
  manifest (every hashed `assets/*` chunk + `.vite/manifest.json` +
  `favicon.svg` + `index.html` 783 bytes).
- `[deploy] dry-run ends here: 3 credential(s) unset — a real deploy
  would refuse and name them` — the refusal behavior confirmed
  verbatim: the real path demands `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`, naming each
  missing one, and runs nothing without all three.

## Preconditions rundown (the contract, verified)

| Precondition | Verdict |
|---|---|
| `dist/` built by `npm run build` (no hand-edited files) | ✅ this rehearsal's dist came from T001's clean build |
| `dist/index.html` at the deploy root (SPA fallback precondition) | ✅ printed by the script itself |
| The three Cloudflare credentials required for the real deploy | ✅ refusal behavior exercised (all three unset here) |
| No non-`VITE_` var can reach the bundle | ✅ the guard suite's standing gate (re-run in verify + release:check) |

## The real deploy

Not exercised by this phase (no credentials in the execution
environment — CHK-03's confirmed division): the owner deploys with
`npm run deploy` per the runbook; the upload it performs is exactly the
manifest above.
