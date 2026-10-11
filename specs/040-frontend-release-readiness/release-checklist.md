# Frontend production-readiness checklist (specs/040, FR-10/SC-002)

Dispositions — the runbook's honesty model: **wired** = a repository
artifact proves it; **operator** = a human action outside this repo,
recorded with owner + console path; **n/a** = not applicable, with the
reason. Nothing here claims "done" for what the repository cannot
perform. Filled in by T001–T016; each row names its proof.

| # | Check | Disposition | Proof / action |
|---|-------|-------------|----------------|
| 1 | Production build succeeds from a clean tree, zero warnings that matter (FR-01) | wired | `build-record.md` — exit 0, ZERO warnings, sha recorded |
| 2 | Bundle budget check recorded per route chunk (FR-02) | wired | `build-record.md` — chunk table + the hard bundleSplit gate green in every verify |
| 3 | No secret in the bundle — guard + named manual inspection (FR-03/SC-004) | wired | T015 — manual inspection command + result over the built assets |
| 4 | Environment values per environment with exact names (FR-04) | wired | runbook §3/§5 (T009) |
| 5 | SPA fallback proven for the five deep-link classes (FR-05/SC-003) | wired | `e2e/production.smoke.test.ts` green against `vite preview` (T007) |
| 6 | Auth redirect URLs for the production domain (FR-06) | operator | T010 — Supabase Auth → URL Configuration, owner: project operator |
| 7 | Caching policy hashed assets vs index.html (FR-07) | wired | T008 — the runbook's caching section (host defaults vs operator config) |
| 8 | Error tracking decision recorded (FR-08) | wired | T011 — vendor-free disposition with rationale + what the operator watches |
| 9 | Rollback procedure (FR-09) | wired | runbook rollback section (T004) — Pages rollback + the three non-rollbackables |
| 10 | Cross-browser/device regression record (FR-11) | wired | `regression-record.md` (T013/T014) — chromium primary, WebKit posture recorded |
| 11 | Release notes in user terms (FR-12) | wired | `release-notes.md` (T012) |
| 12 | Deploy rehearsal + real-deploy division (US1/CHK-03) | wired + operator | `deploy-rehearsal.md` (T003) + the owner's `npm run deploy` |
| 13 | Production build state matrix (cold/deep-link/error/offline/expiry/refused-mutation) | wired | the smoke suite's legs (T007) — the states proven in the built artifact |
| 14 | A11y floor on the built artifact | wired | T014 — the a11y rows against `vite preview` |
| 15 | Screenshots of the release candidate | wired | T015 — desktop/mobile per key surface archived |
| 16 | The final gate window (T016) | wired | `regression-record.md` gate-verdict table |
