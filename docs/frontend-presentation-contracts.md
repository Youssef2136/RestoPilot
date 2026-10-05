## Phase 033 presentation record (reports, audit & void log UX)

The three read-only surfaces got their honesty and readability layer (specs/033; Master
Plan §Frontend Phase 13) with the figures untouched — everything still renders from the
RPCs byte-for-byte through `formatPrice` (Constitution II: no new arithmetic anywhere).
The owner comparison now states its own truth (D1): a same-period sentence derived from
the anchored branch's server-returned bounds, pending rows read 'Loading…', and a failed
branch renders 'Load failed — the figures for this branch could not be loaded.' under
`role="status"` — the old silent '—' (indistinguishable from zero) is gone. The audit
page says what its filter does (D7 exact-match hint wired via `aria-describedby`) and
renders a clamp notice only when the page returns a full 200 entries (D2). All-zero
periods add 'Nothing was recorded in this period.' under the untouched zero figures
(D6); channels and best-sellers gain aria-hidden token-only bars — share of the visible
max, no charting dependency (D4/FA-10); long reasons truncate at two lines with the full
text in the DOM (D5); and the three tables reflow to labelled card rows below 720px via
CSS only (`data-label` cells, thead out of flow — D3, no DOM fork, no assertion change).
NO frozen anchor moved: the six reports.surfaces tests and the bill.void.audit audit
assertions pass unedited; the denials, refusals, and every `data-testid` hook stay
verbatim. Recorded boundary: `get_audit_log` has NO date-range/actor parameters — FR-07
is satisfied to contract (exact match + branch + clamp), anything more is a backend
change (NOT authorized, documented).

| Surface / hook  | Before (phase ≤ 032)                | After (033)                                                                             | Asserted by                     |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| Comparison rows | silent '—' for pending AND failure  | period sentence + per-row posture ('Loading…' / failure text, role="status")            | reports.readability + unit (D1) |
| Audit clamp     | full page looked like the end       | 'Showing the most recent 200 entries — narrow the filters…' only at exactly-limit pages | reportFormat unit (R2)          |
| Action filter   | free-text input, semantics unstated | exact-match hint + `aria-describedby`                                                   | reports.readability (D7)        |
| Zero vs empty   | zeros only, no story                | 'Nothing was recorded in this period.' under the byte-identical figures                 | reports.readability (D6)        |
| Channels/best   | plain rows                          | aria-hidden token bars (share of visible max) beside the unchanged numbers              | reports.readability (D4)        |
| Reasons         | full-width unbounded                | 2-line CSS clamp, title attr, full text in DOM                                          | styles (D5)                     |
| Mobile tables   | horizontal scroll only              | labelled card rows < 720px, no overflow at 390px, zero DOM fork                         | reports.readability (D3/R3)     |

New suite: `e2e/reports.readability.test.ts` (4, serial, read-only — no locks needed):
period sentence + bars + zero hint, filter semantics + clamp absence, the 390px card
walk over all three pages (overflow ≤ 0), and axe WCAG 2.2 AA on the three desktop
pages. Unit: `tests/unit/reportFormat.test.ts` (7 — clamp at exactly-limit, zero-safe
bar shares, period sentence). `reportsClient`/`auditClient`/`useAudit` untouched.
