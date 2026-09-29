# Feature Checklist: Management UX (Phase 06)

Focus: **frozen management anchors preserved** and **scope honesty** (owner-only gating + visible
read-only clarity), per the Master Plan's testing and security directives.

## Frozen anchors (re-skin discipline)

- [ ] All 13 management.surfaces tests pass WITHOUT assertion edits (h1/h2s, warning copy,
      toggle names, table labels, QR payload/download names, denial h1s).
- [ ] full-journey's day-one chain (branch → tables → staff → credential) passes unedited.
- [ ] Working-hours editor labels/behavior byte-identical ('Monday interval 1 closing time',
      'Save working hours', listitem day text, 'No hours configured').
- [ ] The staff phone-number absence pin stays green.

## Scope honesty

- [ ] Owner-only controls render for owners only (RPC remains the boundary — no client trust).
- [ ] Scoped members see an explicit read-only hint per section (Q4) — positive clarity, not
      just absent controls.
- [ ] Out-of-scope deep links render the denial h1 with zero data echo (re-verified, unchanged).

## One-time credential discipline

- [ ] The credential renders only in the provisioning response; never persisted client-side.
- [ ] Copy affordance + "shown only once" notice present; dismissal is final.
- [ ] Outcome wording exact for all three identities (new / linked / stub-completed).

## UX / a11y / responsive

- [ ] Section nav keyboard-operable; fragments reflected in the URL (Q1).
- [ ] Removal confirmation states the consequence (access ends now; the person persists).
- [ ] Hours editor keyboard-operable; invalid combinations prevented client-side where mapped.
- [ ] Table semantics with `th scope`; status pills carry text (not color-only).
- [ ] <768px: tables/staff lists fall back to card rows (same DOM); key actions reachable.
- [ ] Forms preserve input on validation failure; refusals verbatim.

## Discipline

- [ ] Backend impact stays NOT_REQUIRED; client feature layer untouched (unit suites green
      UNCHANGED).
- [ ] New E2E self-cleans (scratch identity removed in-test; unique emails per run).
- [ ] Impeccable detect clean at the gate.
