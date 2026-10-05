# specs/032 — Tasks

- **T001** — `announcementPolicy.ts`: event-class map (round-arrival → cue live region; connection-loss → connection banner; recovery → transient banner; refetch → silent; subscription → banner+panel), `shouldAnnounce` dedupe guard; the pinned copy strings move in byte-identically. Unit tests incl. copy-parity.
- **T002** — Rewire `NewRoundCueBanner`, `ReconnectingBanner`, `OfflineBanner` to source copy/politeness from the policy. Zero DOM/text changes (pins hold); tsc + prettier.
- **T003** — `SubscriptionDetailPanel.tsx` + `subscriptionCopy` mapping + mount under `SubscriptionBanner` for the three non-silent states. Unit tests for the copy map.
- **T004** — Cue supersede unit pin (second INSERT supersedes, no stacking) — new tests only.
- **T005** — `e2e/helpers/subscriptionLock.ts`; wrap platform.surfaces' two date tests (no assertion changes); new `e2e/live.awareness.test.ts` (nearing_expiration + panel + restore; cue no-payload + 390px).
- **T006** — Ledger §Phase 032 record; targeted validation (unit + the new E2E); verify; full suite; checkpoint `feat(032)` + push; report.
