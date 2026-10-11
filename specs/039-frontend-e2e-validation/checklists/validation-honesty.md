# Checklist: Validation Judgement Honesty (specs/039)

**Intent defaults used**: Depth Standard · Audience Reviewer · Focus:
judgement honesty (a scenario without a proof is a gap; a proof with a
weakened assertion is worse).

## Proof honesty
- [x] CHK001 — Does the phase forbid a proof whose assertion was weakened
  to pass, and require the fix-or-assert-intended-behavior posture? [Spec
  §FR-05]
- [x] CHK002 — Is every scenario row required to resolve on disk (cited
  file+test greppable, or new coverage named in a committed file)? [Spec
  §FR-03/FR-04, SC-002]
- [x] CHK003 — Is the "no silent gaps" rule mechanical (a final
  grep-script the reviewer can rerun), not narrative? [Spec §FR-04]
- [x] CHK004 — Is duplicate coverage of an already-proven scenario
  discouraged (cite, don't rewrite — the clarify answer)? [Clarifications,
  plan D1]
- [x] CHK005 — Are the journeys required to drive the UI the way a human
  would, with injections allowed ONLY where documented as the sole path
  (the poisoned-cart precedent)? [Spec §UX]
- [x] CHK006 — Is the console-cleanliness proof expected-vs-unexpected
  (F-G14) and explicitly NOT a blanket zero-errors claim? [Spec §SC-003,
  R5]
- [x] CHK007 — Is the rerun promise concrete (each role's journey runs
  standalone on a fresh reset)? [Spec §US2, D5]
- [x] CHK008 — Is the run window documented (one window, rate-limit
  respected) with a committed summary? [Spec §FR-06, SC-005]

## Scope & safety
- [x] CHK009 — Is the friction-recorded-not-fixed posture explicit (no
  redesign, fixes go to the owning phase)? [Spec §Out of Scope]
- [x] CHK010 — Is zero residue required and the cleanup verifiable
  in-journey? [Clarifications, D3, FR-01]
- [x] CHK011 — Are denial behaviors REQUIRED in the journeys (not happy
  paths only), including a cross-tenant isolation row? [Spec §Security,
  FR-02]
- [x] CHK012 — Do the security rules require no secrets in test artifacts
  and no weakened security assertions? [Spec §Security, FR-05]
- [x] CHK013 — Is the state-matrix spot-check row set concrete (at least
  one loading/empty/error/offline/refusal proof per role, in a real
  browser)? [Spec §State Matrix]
- [x] CHK014 — Are the screenshots a committed record at the journey's
  real viewports (not extra headed runs)? [Spec §SC-004, D6]
- [x] CHK015 — Is WebKit's exclusion recorded as a clarified decision
  rather than an omission? [Clarifications, D4]
- [x] CHK016 — Is "the whole thing rerunnable and trustworthy" pinned as
  the exit criterion with verify green? [Spec §US3 maintainer story, FR-06]
