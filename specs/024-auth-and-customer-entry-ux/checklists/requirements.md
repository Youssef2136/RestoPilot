# Phase 04 — Requirements Checklist

## Frozen semantics (must NOT change)

- [ ] Single generic sign-in failure message; recovery never enumerates; verify-then-update change flow (spec 020).
- [ ] Guards, return-to, expired note, multi-tab session semantics.
- [ ] `restopilot.session-token` key and storage discipline (FR-10); no "remember me".
- [ ] Server refusals verbatim (`P0001` → text; `42501` → generic denial; else retry).
- [ ] Session token algorithm, `open_session_at_table`/`open_session_channel` shapes (`parseEntry`).

## Verbatim E2E names (preserve or migrate-with-record)

- [ ] `Branch`, `Table`, `Your name`, `Phone number` labels (entry).
- [ ] `Join the table` / `Start a delivery order` / `Start a takeaway order` action labels.
- [ ] h1 `Blue Olive` (restaurant name) on entry; indicator `Blue Olive · Downtown · Table T3`.
- [ ] h1 `Staff sign-in`, `Password recovery`, `Reset your password`, `Account password`, `RestoPilot`.
- [ ] Client validation messages byte-identical (name bounds, phone regex, address bound, table/branch choices).
- [ ] `A session is already open at this table. Join it instead.` (verbatim race refusal).
- [ ] `Restaurant not found` (h1) on unknown slug.

## Phase additions (must land)

- [ ] `/` = real landing (h1 RestoPilot + purpose + QR/slug guidance + Staff sign-in link).
- [ ] `/order/:branchId` redirects to `/?branch=<id>` with landing guidance.
- [ ] Join guidance note under the table picker (Q4 copy).
- [ ] `autocomplete`/`inputMode` audit on every credential + identity field.
- [ ] ≥ 44 px targets + sticky primary action at 390 px; no horizontal scroll (responsive smoke).
- [ ] axe scan covers `/r/blue-olive` (target: zero violations, baseline untouched).
- [ ] Console-clean navigation over the entry flow (expected refusals named per F-G14).
- [ ] Focus moves to the first invalid field on failed client-side submit.
- [ ] Evidence screenshots committed.

## Gates

- [ ] `npm run verify` green. [ ] `npm run test:e2e` green (auth.routes, session.surfaces, routes, smoke, route.titles, a11y, responsive, shell all green). [ ] `feat(024)` checkpoint + push.
