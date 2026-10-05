# Phase 06 Decisions (specs/026-management-ux)

## D1 — Section navigation via fragments, no tabs/sub-routes (Q1)
The four Master-Plan routes stay the only routes; ManagementLayout renders a sticky in-page nav
('Restaurant sections' / 'Branch sections' — distinct from the shell's frozen 'Staff area'),
clicks scroll + replaceState the fragment, and deep links with a hash scroll on mount. The nav
collapses to the 025 horizontal-scroller pattern <1024px. A11y: plain buttons, distinct nav label.

## D2 — Branch detail absorbs tables/hours as sections (Q3)
The current single-page composition was kept and formalized: BranchHeader + section nav
(Hours/Tables) + SectionCards. The sessions entry stays in the header meta (its pinned link
shape unchanged). Deep-link tables management (realtime/management pins) untouched.

## D3 — Read-only clarity via ScopeBadge, controls still absent for non-owners (Q4)
The denial tests pin ABSENT controls; the badge adds the positive explanation ('Read-only',
text-bearing, dashed) on hours/tables sections for scoped members and 'Owner controls' on the
QR card. No control is ever rendered for a non-owner (the RPC remains the boundary).

## D4 — StaffTable kept a real table; mobile fallback via data-label pseudo-content
The existing `th scope` table survived (its semantics were already right); the mobile card-row
fallback renders from the SAME DOM using `td[data-label]::before` content — no duplicated
markup, no JS breakpoint logic (the 025 same-DOM dual-posture lesson applied to tables).

## D5 — New E2E provisions a scratch identity and removes it through the real dialog
Self-cleaning by construction: unique per-run name/email, bounded pre-cleanup of residue, and
the removal exercise IS the FR-05 consequence-dialog test. The last-owner safeguard is proven
on the seeded sole owner (Alice) with the verbatim refusal.

## D6 — QR download formats untouched (Q5)
No size options invented; SVG/PNG downloads keep their accessible names; the QR card gained
guidance text and the 'Owner controls' badge only.
