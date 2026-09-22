# Checklist: Security Correctness and Proof (Phase 14)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) · Created 2026-09-22

Reviewer-owned (per the 005–014 convention: checked by a human reviewer,
not by the implementing agent).

## Attack fidelity (does the suite actually attack?)

- [ ] Every probe drives a REAL role (anon / authenticated fixture JWT) —
      no probe uses the postgres role to simulate an attacker
- [ ] The role matrix covers all four staff roles × both restaurants, and
      the customer path drives only through tokens
- [ ] Tenant-isolation probes cross BOTH directions (Blue Olive → Cedar
      Grill and Cedar Grill → Blue Olive)
- [ ] Session-abuse probes include statistically plausible guesses, not
      only obviously-invalid strings

## Contract preservation (does the fix change what it must not?)

- [ ] Every refusal keeps its verbatim contract message (generic 42501,
      indistinguishable session-unavailable, documented validation texts)
- [ ] No probe was weakened or deleted to make the suite pass
- [ ] Any fix added is authorization/validation-only (no behavior or UX
      change) with its own regression test
- [ ] The client-parsed payload shapes are unchanged (parseEntry/parseRound
      and friends still pass their suites)

## Exit condition

- [ ] `npm run verify` passes with the security suites joined into the
      standing gates (the exit condition is a persistent state, not an
      event)
- [ ] Every §25 review area maps to at least one named probe in the suites
- [ ] No known critical authorization bypass remains open (all findings
      either fixed or explicitly documented as accepted platform behavior)

## Posture

- [ ] The secrets assertion covers both the built bundle and the source env
      contract, and fails (not skips) on a real finding
- [ ] The audit-trail immutability probes cover grants, policies, and the
      RPC surface for anon, authenticated, and the token path
