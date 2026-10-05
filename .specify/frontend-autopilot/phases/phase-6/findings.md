# Phase 06 Findings (specs/026-management-ux)

## F1 — SectionCard must let children own pinned headings (MEDIUM, by design)
The QR panel carries the frozen h2 'Customer entry QR'; a SectionCard that always renders its own
h2 would double it. SectionCard's title became optional (aria-labelledby only when the card owns
the heading). Lesson for shared wrappers: frozen headings force composition freedom.

## F2 — E2E residue is generative, not just cumulative (MEDIUM)
The new provisioning suite's scratch identities survived failed runs (the credential step died
after the RPC committed), and the next run hit strict-mode four-member collisions. Fix: unique
per-run names/emails PLUS a bounded (≤5) pre-cleanup loop through the real removal dialog —
which also exercises FR-05's removal path every run. Residue tests need residue-aware design,
not just db:reset discipline.

## F3 — Assert the server's ACTUAL verbatim strings, never paraphrases (LOW → fixed twice)
Two new-suite expectations paraphrased the server/UI: the dialog says 'Their profile and
sign-in identity remain.' (not 'remain'), and the last-owner refusal is 'A restaurant always
keeps at least one owner.' (no 'last owner' phrase). The verbatim-refusal rule cuts both ways:
render verbatim AND assert verbatim. Fixed by reading the failure context, not guessing.

## F4 — clipboard in headless needs explicit permission grants (LOW, operator note)
The credential copy affordance degraded to its documented 'unavailable' path under headless
Chromium. The test grants clipboard-read/write (the degradation path remains exercised by the
unit-level copyState logic). Recorded so future copy-affordance tests don't rediscover it.

## Carried warnings
- R2: Impeccable launcher remains detect-only (from 022).
- verify's db gate requires a fresh reset after heavy E2E (phases 05/06 both re-proved it).
