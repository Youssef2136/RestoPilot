# specs/037 — Research

## research.md

- **R1 — Existing state surfaces (what exists today).** The repo already renders
  refusals verbatim at action sites (menu availability, round transitions,
  void/session flows), has toast/error infrastructure from Phase 03, and a
  `RouteErrorView`/`NotFoundView` pair (labelled sections since Phase 15). The
  phase composes and systematizes these — it does not start from zero.
- **R2 — Query-client policy (Phase 01).** Read-side retry is currently default
  (retry: 1 on reads per the Phase 01 policy review); mutation side has no auto
  retry. The clarified policy (one automatic read retry) matches the standing
  behavior; the phase documents it in the vocabulary instead of changing it.
- **R3 — Realtime recovery contract.** Realtime `SUBSCRIBED` recovery and the
  existing disconnect/reconnect E2E harness (spec 032's controlled scenarios)
  are the reuse point for D6's reconnect injection — no new harness needed.
- **R4 — Offline infrastructure (Phase 03).** The offline/toast infrastructure
  exposes connectivity state; `OfflineSurface` wraps it with the
  staleness-obvious treatment and the disabled-with-reason action layer.
- **R5 — Skeleton precedent.** The customer menu already uses a loading
  treatment; the `Skeleton` family generalizes it with the sizing contract
  (dimensions match content, no shift on swap) at the 640/1024/1440 scale.
- **R6 — High-risk mutation inventory.** The double-submit guard exists on the
  named high-risk actions (submit round, transitions, void, close session,
  onboarding submit) as the disabled-while-in-flight rule; FR-06's audit walks
  every other action button in the codebase and fixes gaps.
- **R7 — Session expiry path.** Phase 04's auth guards already redirect expired
  sessions to the auth surface with a return-to target; FR-10's work is the
  designed explanation + fallback composition at the shell level, not a new
  redirect mechanism.
- **R8 — Partial failure surface.** The reports comparison is the one
  multi-branch read surface (spec 033); `PartialFailureNotice` targets it, with
  per-branch retry scoped to that surface's data layer.
- **R9 — Announcement discipline.** The Phase 15 announcement policy map pins
  polite/alert usage per surface; the state family inherits it (loading polite
  once, refusal/error alert once per event) — no new live-region semantics.
