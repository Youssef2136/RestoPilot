# specs/033 — Reports, Audit & Void Log UX

## spec.md

### Purpose
Make operational truth readable on the existing three read-only surfaces
(`/dashboard/reports`, `/dashboard/voids`, `/dashboard/audit`) — figures come from the
RPCs verbatim; the phase upgrades HONESTY and READABILITY, not the contract.

### Decisions (D1–D7)
- **D1 — Comparison honesty (FR-05).** Every comparison row states its own posture:
  the period sentence renders once above the table ('Same period for every branch:
  …'), a pending row shows 'Loading…', a failed row renders 'Load failed — the
  figures for this branch could not be loaded.' with `role="status"` per-row, and a
  zero row is distinguished from a failed one. Partial failure is never '—'.
- **D2 — Clamp notice (state matrix).** When the audit page returns a FULL 200-entry
  page, a notice renders: 'Showing the most recent 200 entries — narrow the filters
  to see more.'; below the clamp nothing renders. 200 is the page size the client
  already requests (useAudit limit: 200; server clamp 1..200).
- **D3 — Mobile card fallback (Responsive).** The three tables fall back to card rows
  below the mobile breakpoint via CSS grid on `data-table-*` wrappers — no DOM fork,
  assertions bind by testid/text regardless of layout. Money columns stay
  horizontal-safe.
- **D4 — Bars, dependency-free (FA-10).** Channel breakdown and best-sellers gain a
  token-driven bar (`--color-…`/`--radius-sm` only; width = share of the row's max;
  no charting dependency). Bars carry NO meaning that the adjacent numbers don't
  already state (a11y: text equivalent is the table itself; bars aria-hidden).
- **D5 — Reason truncation (Visual).** Long reasons truncate at ~48ch with the full
  value available (title attr + wrap on card layout; never clipped unread by SRs —
  full text stays in the DOM, CSS `line-clamp` only).
- **D6 — Zero vs empty (UX).** An all-zero aggregates grid renders a hint line under
  the grid: 'Nothing was recorded in this period.' — zeros stay rendered (the server
  figures, byte-for-byte) and the hint distinguishes an empty period from a broken
  one. Existing zero-state assertions ('0' visible, best-sellers empty note) hold.
- **D7 — Filter honesty (FR-07 within the contract).** The Action filter states its
  exact-match semantics in its description ('matching exactly, e.g. round.void').
  Date-range/actor filters are NOT added: `get_audit_log` has no such parameters and
  the backend is not authorized to change (recorded; FR-07 satisfied to contract).

### Out of scope (unchanged from the Master Plan)
No new RPCs, no client money aggregation, no exports, no charting dependency, no
cashier/kitchen rendering, no accounting framing.

### Frozen anchors (must pass unedited)
`e2e/reports.surfaces.test.ts` (6 tests), `e2e/bill.void.audit.test.ts`
(audit/void assertions), `tests/unit/reports.test.ts`, all `data-testid` hooks,
formatPrice everywhere, denial/refusal copies verbatim.

> Normalized 2026-10-06: the embedded plan/tasks/checklists/analysis sections moved
> to standalone files (the 031/032 pipeline layout). Content verbatim; the embedded
> tasks list was strictly superseded by the standalone evidence-annotated
> `tasks.md`. Implementation stands at `3356b7d`; no pipeline step re-run.
