# Implementation Plan: 034-platform-console-ux (Frontend Phase 14)

**Mode**: Operate (refinement over existing console surfaces) · **Baseline**: `9fd0268` · **Backend impact**: NOT_REQUIRED — the five platform RPCs verbatim

> Normalized 2026-10-06: extracted verbatim from the single-file `spec.md` (committed in `9dba5d3`) into this standalone plan, the 031/032 pipeline layout. The implementation is the same commit, recorded in `.specify/frontend-autopilot/phases/phase-14/report.md`.

| Aspect | Decision |
| --- | --- |
| Routes | /admin (D5 posture), /admin/platform (D1-D4) — unchanged |
| Components | TenantTable (extracted), SubscriptionStatePill (D1), DatesDialog stays inline form + D4 validation, SortHeader buttons, Card-fallback css shared |
| State/data flow | existing usePlatformOverview/useSetSubscriptionDates/useSetPlatformDisabled/useOnboardRestaurant — only the RENDER changes + toasts (D2) |
| Backend | NOT_REQUIRED — five RPCs verbatim |
| Testing | unit: stateLabel helper (D1) + posture summary (D5); E2E `e2e/platform.console.test.ts` (3): sort/filter, toasts on dates+disable+re-enable (locked), 390px cards + axe on both routes |
| Frozen | platform.surfaces 7/7 verbatim; platform.test unit 14/14 preserved (extended) |
