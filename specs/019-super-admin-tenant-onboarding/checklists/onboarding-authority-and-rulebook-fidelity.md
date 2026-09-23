# Checklist: Onboarding Authority and Rulebook Fidelity (Phase 18)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) · Created 2026-09-23

Reviewer-owned (per the 005–019 convention: checked by a human reviewer,
not by the implementing agent).

## Authority and reach (the flag grants nothing extra)

- [ ] `onboard_restaurant` refuses every non-super-admin identity
      (owner, manager, cashier, kitchen, membership-free fiona, anon)
      with the generic console 42501 denial — indistinguishable from any
      other denial
- [ ] The flag's standing reach is unchanged after the phase: the super
      admin remains refused the tenant audit read and every tenant
      operational surface (FR-008b proven by the reach matrix, not
      asserted)
- [ ] No policy, grant, or read path outside the new RPC was widened
      (diff review confirms)

## One rulebook (the refactor is honest)

- [ ] `create_restaurant` behaves identically after the extraction — the
      standing management + security suites pass unchanged (T012's gate)
- [ ] The shared validation helper carries the verbatim messages and
      rules; the onboarding path cannot accept inputs the tenant-creation
      surface would refuse (and vice versa)
- [ ] The all-or-nothing proof counts zero rows across all four tables
      after every refusal path (FR-004)

## Credential discipline (the one-time contract)

- [ ] The credential reaches the console exactly once — never logged,
      never persisted server-side, rotatable through password recovery
- [ ] The three provisioning cases behave per the deployed helper's
      contract: new person (issued), stub (re-issued), linked (null) —
      plus the dual-role edge case (super admin as first owner)
- [ ] The console clears the displayed credential on the next action and
      keeps form state on refusal

## Lifecycle and audit (indistinguishable from a self-bootstrapped tenant)

- [ ] The subscription row is created in the same transaction and reads
      `never_activated`; ordering from an onboarded tenant succeeds until
      the platform owner decides otherwise (014's Important rule intact)
- [ ] The backfill makes pre-existing bootstrap tenants visible in the
      console overview — and nothing else changed on that surface
- [ ] Exactly one audit row per onboarding: acting super admin as actor,
      the outcome in the reason; the new owner reads it through the
      tenant audit surface, the super admin does not

## Scope walls respected

- [ ] The self-bootstrap creation path is untouched in behavior (only its
      validation is extracted)
- [ ] No additional-owner provisioning from the console; no rename or
      delete of tenants; no auto-activation; no automated email delivery
- [ ] No schema changes beyond none — the migration adds functions and
      the backfill, zero new columns or tables
