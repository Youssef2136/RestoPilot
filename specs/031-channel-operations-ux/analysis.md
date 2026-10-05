# Analysis — 031-channel-operations-ux (SpecKit ANALYZE, pre-implementation)

**Scope check vs artifacts**: spec D1–D6 ↔ plan ↔ tasks ↔ checklists — every FR (01–07) maps to ≥1 task and ≥1 checklist row; no FR without an evidence plan; no task outside the phase's routes.

**Constitution/law conflicts**: none. No new RPC/read/type; no optimistic writes (all state from refetched reads); RPC boundary intact (the two transition RPCs are called through the existing client). D5 is a RECORDED conflict, deliberately not patched (scope rule).

**Frozen-pin collision scan (the phase's main risk)**:
1. `session.surfaces` FR-011 adds above the cutoff → collides with D1's disabled add. **Resolved by recorded migration** (T009): add moves below the cutoff; the tested contract (four transitions, verbatim refusal, preserved cart) is unchanged. This is the phase's ONLY pin edit and it is recorded in spec D1 + checklist F2 + the test header.
2. customer.menu single `role="status"` → new announcements use `aria-live="polite"` paragraphs; the timeline is a plain ol. Verified by design + axe + the existing strict lookup passing.
3. `Add to cart`/spinbutton pins (customer.menu, full-journey, session.surfaces US1/US2) are all DINE-IN sessions → `cutoffCrossed` returns false → the disabled path never renders there. Dine-in byte-parity is a task gate (T003).
4. cashier board pins (`data-round-state`, group labels, button names, cue badge, bill figures) → the filter defaults to All (identical output); completion dialog only wraps the ONE button no pinned test clicks (grep: only a visibility assertion). Dispatch stays one-tap (the four-transition journey clicks it directly).
5. kitchen pins → zero kitchen code changes.
6. `Indicator` text pin `Blue Olive · Downtown · Delivery` → ChannelChip keeps the exact label text inside the same paragraph.

**Ambiguities**: none open — the Master Plan's four expected clarify questions are settled (D1–D4); the two inspection-forced decisions are recorded (D5 payload gap, D6 assertion-only kitchen).

**Sequencing risks**: T003/T004 share the customer page (land together, one targeted check); T009 must land with T003 or the FR-011 journey breaks (disabled add arrives before the migration) — implemented in the same working tree before any full E2E run.

**Verification budget**: unit + typecheck + targeted E2E (session.surfaces channel block + new file) during implementation; full verify + full Playwright at the gate; db:reset before verify and before any Playwright run.
