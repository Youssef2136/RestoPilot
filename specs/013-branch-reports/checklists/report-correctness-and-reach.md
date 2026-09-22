# Checklist: Report Correctness, Reach, and Absence (Phase 12)

**Purpose**: Domain-specific gate before implementation — the three ways a
reports feature can be wrong.

**Feature**: [spec.md](../spec.md) | [Plan](../plan.md)

## Correctness (the anti-drift proof)

- [ ] Every money figure the RPC returns is derivable in one SQL pass from
      `rounds.subtotal + rounds.tax_total` over non-voided rounds joined
      through `sessions` — verified by a test that hand-sums the source rows
      and compares
- [ ] Bucket boundaries are calendar-aligned: day = one calendar day, week =
      Monday-start, month = calendar month — including a bucket that spans a
      year boundary
- [ ] Voided rounds are excluded from net money and channel breakdown but
      counted in "rounds voided"; a fully-voided period shows net 0.00 with
      the void count intact
- [ ] Best-sellers rank by captured `round_items.quantity` net of voids,
      ties broken deterministically, capped at 10
- [ ] Channel breakdown covers all three `sessions.type` values, including
      channels with zero rounds in the period (explicit zero, not missing)
- [ ] Empty period returns zero-valued aggregates and an empty best-seller
      list (no division, no null leakage)

## Reach (who may see what)

- [ ] Owner: any branch of their restaurant, restaurant-wide audit
- [ ] Branch manager: their managed branch/branches only — own branch OK,
      foreign branch refused
- [ ] A manager of two branches receives the union, not just the first
- [ ] Cashier and kitchen: `42501` from both RPCs — same refusal as any
      other denial (indistinguishable, 009 posture)
- [ ] Anon/unauthenticated: refused with the generic refusal (no existence
      leaks)
- [ ] Reach uses `private.has_branch_role` verbatim — no re-implemented
      predicate

## Absence (the negative surface)

- [ ] No route under the staff shell renders reports for cashier/kitchen;
      deep-linking the URL shows the denial state, not the data
- [ ] Cashier/kitchen navigation has no reports entry
- [ ] The void log page calls `get_audit_log` with `p_action='round.void'`
      — no second void-ledger exists (grep-verifiable)
- [ ] No materialized view, summary table, or counter column is added
      (grep-verifiable against the migration)
- [ ] No new write path, grant, or RLS policy beyond what reports read
      (the phase adds RPCs, nothing else)
- [ ] Money formatting goes through the established money formatter; no
      client-side arithmetic on report figures

## Walkthrough

- [ ] Quickstart walkthroughs reconcile a seeded period end-to-end with real
      sign-ins and restore deterministic state afterwards
