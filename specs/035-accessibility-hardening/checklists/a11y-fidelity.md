# Checklist: Phase 15 — Fidelity to frozen contracts (specs/035-accessibility-hardening)

> Reviewer-approved 2026-10-06 (the implement gate, all items approved by the project owner in-session). Execution evidence per item recorded inline (T017 closure); the anchors were verified against the 244/244 Playwright closure.

The pinned assertions this phase must pass UNEDITED while the a11y hardening lands. A fix that would move a pinned name/text/role follows the Category-A discipline (ledger-recorded, paired tests updated in the same commit, justified) — never a silent rename.

## Accessible-name & live-region pins (the regression net)
- [x] Button/action accessible names verbatim everywhere pinned: 'Accept round', 'Start preparation', 'Mark ready', 'Send out for delivery', 'Mark completed', 'Lock round', 'Reduce one', 'Remove line', 'Void round', 'Confirm void', 'Cancel', 'Show bill', 'Void reason', 'Dismiss' (029 cashier-fidelity anchors). — cashier/kitchen/session suites green; no name moved (ledger §035: zero Category-A).
- [x] Live-region pins verbatim: NewRoundCueBanner role=status 'A new order arrived.'; pickup-ready announcement 'Your pickup order is ready.'; submit-success 'Your order is in — the kitchen has ticket N' (no focus steal). — live.awareness + keyboard.journeys green; the no-steal asserted positively (T007).
- [x] BranchSessionsPanel's inline closure notice stays the ONLY role=status on that surface; ReconnectingBanner stays polite-but-not-status (032 rationale comments intact). — session.surfaces green; the one-region contract unit-pinned (announcementSurfaces).
- [x] Denial/refusal copies verbatim (`data-refusal` paragraphs; 'Not authorized' posture pages) — an improved denial view discloses nothing new. — matrix denial rows scanned as-seen; denial suites green; no authorization surface touched.
- [x] Skip link stays first in tab order targeting `#main` on BOTH shells; landmarks keep their accessible names. — the shell floor asserted on all 31 matrix rows; F-002 removed the nested duplicate mains.

## Floor & tooling contracts
- [x] `e2e/helpers/a11y.ts` rule tags unchanged (wcag2a/2aa/21a/21aa/22aa per 021 Q2); the committed baseline gains ONLY owned entries with written justification + owner phase. — tags untouched; the baseline gained ZERO entries (every finding was fixed, not waived).
- [x] The jsx-a11y lint rule set is never weakened to let an audit fix pass. — verify's lint leg green on the final tree.
- [x] Viewport projects untouched (mobile 390×844 / tablet 834×1112, spec 021 FR-08). — playwright.config.ts unmodified; the viewport suites green in the closure.
- [x] The 032 announcement policy artifact (`features/realtime/announcementPolicy.ts`) is amended, not forked, if the audit corrects it. — the audit found no corrections needed; the file is untouched and its unit suite green.

## No-regression posture
- [x] No RPC, type, or RLS change; no authorization decision touched (constitution III/IV). — the diff touches presentation/CSS/tests/docs only.
- [x] Every existing E2E suite passes unedited except deliberate Category-A migrations recorded in `docs/frontend-presentation-contracts.md`. — 244/244 on the reset DB; the two timing flakes green isolated; the only suite EDITS are the spec's own additive legs (T007) — recorded in §035.
- [x] No visual redesign: fixes use the existing token system; no 'accessibility mode' fork; if a fix needs a system change, it amends the system once, centrally. — F-003/F-006 are token-driven; Dialog is a lifecycle fix, not a visual fork.
- [x] All 'Never activated'→'Not activated yet' (034) and other ledger Category-A history stays coherent — no re-migration. — platform suites green unedited.

## Gates
- [x] `npm run db:reset -- --yes` before verify AND before any full Playwright run (Phase-14 environmental record). — run before verify and before each Playwright batch.
- [x] `npm run verify` EXIT 0; the expanded a11y matrix green (zero unwaived findings); keyboard-journey specs green. — verify green on the final tree; matrix 31/31; journeys 4/4.
- [x] Prettier on every new/edited file before verify (format:check is a gate). — verify's format:check leg green.
