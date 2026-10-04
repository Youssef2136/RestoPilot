## Phase 032 presentation record (realtime, notifications & subscription awareness UX)

The awareness layer got its central announcement policy and its honest subscription story
(specs/032; Master Plan §Frontend Phase 12). `announcementPolicy.ts` is the one map from
(event class, dedupe key) → surface/politeness/copy; the cue, reconnecting and offline
banners re-wired onto its FROZEN byte-identical strings (zero DOM change — every lock
held). The cue's one-slot supersede is now pinned by tests: a second INSERT replaces the
visible announcement, only the CURRENT round's advance clears it, and a foreign round's
update is ignored. `SubscriptionDetailPanel` is the honest owner-facing detail (D5): an
in-flow disclosure under the banner — no route, no console, no ticket escape hatch — with
per-state copy. D3 keeps the product quiet: passive events toast nothing, no activity
panel exists. The platform_disabled copy carries the REVERSED truth learned in 030:
ordering stays available during a manual pause; only the platform re-enables
(`state='platform_disabled'` is passed straight through the detail panel). The two
platform-console date journeys (activate → nearing_expiration, expire → expired) are
filed under a new cross-file `subscriptionLock` (the mkdir+steal t2Lock pattern) because
both mutate the SAME blue-olive subscription row; the console proves each write landed
via its own state column. NO frozen anchor moved: platform.surfaces' assertions are
untouched (only the lock wrapper was added); the cue's fixed line, the recovered and
reconnecting pins, and every policy string are byte-identical to their pre-phase values.

| Surface / hook        | Before (phase ≤ 031)                            | After (032)                                                                                       | Asserted by                        |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Announcements         | per-component string literals                   | one `announcementPolicy` map (surface, politeness, copy) + 1 s dedupe guard                       | announcementPolicy unit (9)        |
| Supersede             | implied by INSERT-derivation, unpinned          | pinned: INSERT supersedes; current-round advance clears; foreign UPDATE ignored                   | newRoundCue.supersede unit (3)     |
| Subscription detail   | banner state only, no explanation               | `SubscriptionDetailPanel` disclosure (aria-expanded) under the banner, no route                   | live.awareness (FR-05, D5/D7)      |
| nearing_expiration    | no E2E journey                                  | console-driven activate journey + banner state + honest detail                                     | live.awareness (new suite)         |
| no-payload cue        | payload discipline asserted only in unit        | live E2E: exactly the fixed line + 2 affordances (count 3), no name/item/money/ids                 | live.awareness (F1)                |
| 390px with live cue   | untested with the cue visible                   | no horizontal overflow with the cue in flow                                                        | live.awareness (F6)                |
| Date journeys         | unserialised console mutations on one row       | `withSubscriptionLock` around both; restored to active (end_date +30) before release               | platform.surfaces + live.awareness |
| Detail-panel visuals  | n/a (new component)                             | approved tokens only (`--color-border`, `--radius-sm`, `--color-surface-raised`)                   | design pass                        |

New suite: `e2e/live.awareness.test.ts` (2, serial): the nearing_expiration journey
(console activate → 'Nearing expiration' column → owner banner + detail + collapse →
restore to active) and the cue no-payload/390px journey (ACK-gated join, payload fields
absent, overflow 0 with the cue visible). Unit: `tests/unit/announcementPolicy.test.ts`
(9 — byte-identical strings, dedupe window, politeness) + `subscriptionCopy.test.ts`
(5 — the reversed platform_disabled truth) + `newRoundCue.supersede.test.ts` (3).
`e2e/platform.surfaces.test.ts`: the two date journeys wrapped in `withSubscriptionLock`,
assertions untouched.
