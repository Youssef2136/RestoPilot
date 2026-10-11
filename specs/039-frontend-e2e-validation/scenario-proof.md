# Scenario → Proof table (T010 — FR-03/FR-04)

Every enumerated validation scenario: **CITED** (a standing suite, unchanged)
or **NEW** (this phase's coverage). Reviewer check: each row's file+test
resolves on disk (`npm run verify:scenario-proof` — T011's script).

| # | Scenario | Status | Proof (file › test) |
|---|---|---|---|
| 1 | Realtime arrival (the live board receives a new round/ticket) | CITED | e2e/realtime.test.ts › the kitchen queue updates live and stays money-free (SC-002) |
| 2 | Reconnect recovery (resubscribe + refetch) | CITED | e2e/realtime.test.ts › the live cue renders on a new round and the reload path reconciles (SC-004, US4) + e2e/realtime.test.ts › a round advanced in a second staff browser moves the card groups live here (SC-001) |
| 3 | Notification/cue behavior | CITED | e2e/live.awareness.test.ts › the cue announces arrivals without payload data |
| 4 | Cutoff behavior (delivery cutoff refuses above preserved cart) | CITED | e2e/session.surfaces.test.ts › the delivery cutoff refuses additional orders above the preserved cart (FR-011) |
| 5 | Void with reason (honest overlay, bill reduction) | CITED | e2e/bill.void.audit.test.ts › carla voids a locked real round + e2e/release.journey.test.ts › the void with reason lands honestly |
| 6 | Audit visibility (owner/manager reach) | CITED | e2e/bill.void.audit.test.ts › alice sees the audit trail + e2e/release.role-manager.test.ts › manager |
| 7 | Subscription states (disable/enable journey) | CITED | e2e/platform.surfaces.test.ts › disablement blocks the customer entry + e2e/platform.surfaces.test.ts › re-enable restores the tenant state |
| 8 | Responsive completion at 320/390/430 | CITED | e2e/responsive.overflow.test.ts › the guest |
| 9 | Responsive tablet/desktop device classes | CITED | e2e/responsive.devices.test.ts › device + e2e/responsive.orientation.test.ts › rotation |
| 10 | Accessibility assertions (route×state matrix) | CITED | e2e/a11y.matrix.test.ts › a11y matrix + e2e/touch.targets.test.ts › the customer menu + e2e/keyboard.journeys.test.ts › keyboard + e2e/motion.preferences.test.ts › motion |
| 11 | Console cleanliness (expected-vs-unexpected, F-G14) | CITED | e2e/gallery.error.test.ts › the recovery links navigate to working routes |
| 12 | State matrix — loading (a skeleton seen) | NEW | e2e/release.journey.test.ts › the owner sets up the scratch tenant + e2e/state.reads.test.ts › the staff list skeleton |
| 13 | State matrix — empty (a zero-result posture) | NEW | e2e/release.journey.test.ts › two rounds flow + e2e/state.reads.test.ts › controlled empty reads |
| 14 | State matrix — error (an honest posture line) | NEW | e2e/release.role-guest.test.ts › guest at 390px + e2e/state.reads.test.ts › staff list |
| 15 | State matrix — offline/reconnect (banner lifecycle) | NEW | e2e/release.journey.test.ts › the void with reason + e2e/state.operations.test.ts › offline oversight |
| 16 | State matrix — refusal (a verbatim refusal) | NEW | e2e/release.journey.test.ts › the void with reason + e2e/release.role-cashier.test.ts › cashier + e2e/state.operations.test.ts › injected refusal |
| 17 | Per-role: owner primary task + denial | NEW | e2e/release.role-owner.test.ts › owner: the management surfaces answer, a super-admin deep link is denied honestly (FR-02) |
| 18 | Per-role: branch manager + out-of-scope branch denial | NEW | e2e/release.role-manager.test.ts › manager: Downtown oversight |
| 19 | Per-role: cashier real-round + refusal | NEW | e2e/release.role-cashier.test.ts › cashier: a real guest round flows accept |
| 20 | Per-role: kitchen money-free Marina board + rounds denial | NEW | e2e/release.role-kitchen.test.ts › kitchen: the Marina board runs its money-free ticket path, the rounds surface denies kitchen (FR-02) |
| 21 | Per-role: platform console + staff-area boundary | NEW | e2e/release.role-platform.test.ts › platform admin: the console lands, tenants are visible, and the staff area is out of bounds (FR-02) |
| 22 | Per-role: public guest 390px + token isolation | NEW | e2e/release.role-guest.test.ts › guest at 390px: entry, two rounds, status visibility, a foreign token is refused cleanly (FR-02) |
| 23 | One connected story (scratch tenant setup→reporting, zero residue) | NEW | e2e/release.journey.test.ts › the owner sets up the scratch tenant + e2e/release.journey.test.ts › cleanup: the seed returns |
| 24 | Cross-tenant isolation at the UI level | NEW | e2e/release.role-guest.test.ts › guest at 390px: entry, two rounds |
| 25 | Customer menu interactive budget/interaction (perf smoke) | CITED | e2e/perf.customer.test.ts › the throttled journey + e2e/perf.boards.test.ts › a burst arrival |
| 26 | Expiry (session ended → redirect with the note) | CITED | e2e/state.expiry.partial.test.ts › a failed auth-context read |

Zero unresolved rows: every scenario is cited or newly covered, and the
citations resolve (T011's script).
