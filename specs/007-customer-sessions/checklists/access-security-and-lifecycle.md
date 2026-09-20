# Checklist: Access Security and Session Lifecycle (Phase 6)

**Purpose**: Validate requirements quality for the customer access mechanism and the session lifecycle — the two highest-risk clusters of this feature (master plan Risk 5: session security as an afterthought; Risk 7: concurrency corruption).

**Created**: 2026-09-19

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

**Ownership note**: this is a reviewer-owned requirements-quality artifact. `[x]` means the reviewer determined the requirements-quality criterion is satisfied — it does NOT mean implementation work is complete. `$speckit-implement` reads checklist state but does not modify markers.

## Access Security Requirements (Risk 5)

- [ ] CHK001 - Are the required properties of the session access mechanism (unguessability, one-session binding, server-side verification) all stated as testable requirements rather than aspirations? [Completeness, Spec §FR-011/FR-012]
- [ ] CHK002 - Is the failure behavior when a token is invalid, stale, or bound to a closed session specified so no session history leaks through the error? [Clarity, Spec §FR-014]
- [ ] CHK003 - Are denial requirements defined for every cross-session access attempt (one session's mechanism against another session's context) with the denial layer named? [Coverage, Spec §FR-012/FR-020]
- [ ] CHK004 - Is it specified that possession of the access mechanism grants no capability beyond its own session's context (staff data, other branches, configuration)? [Completeness, Spec §FR-011/FR-012]
- [ ] CHK005 - Are the customer-identity requirements explicit that no account, credential, or staff-identity linkage may exist? [Completeness, Spec §FR-015]
- [ ] CHK006 - Are requirements defined for what customer data may appear in which payload (customer's own context vs staff oversight vs public page)? [Coverage, Spec §FR-017, Gap]
- [ ] CHK007 - Is the storage/recovery behavior of the access mechanism on the customer device specified (where it lives, when it is cleared, what happens when lost)? [Completeness, Spec §FR-013/FR-014, Contracts §2]
- [ ] CHK008 - Are abuse scenarios enumerated as acceptance criteria (tampered token, no token, cross-session token) with measurable denial rates? [Acceptance Criteria, Spec §SC-002]
- [ ] CHK009 - Is the closed-session reassociation rule stated precisely enough to test (what a stale device sees, where it is directed)? [Clarity, Spec §FR-014]
- [ ] CHK010 - Is it specified that server-side verification applies to every session-scoped operation, not only entry? [Consistency, Spec §FR-020]

## Session Lifecycle and Concurrency Requirements (Risk 7)

- [ ] CHK011 - Is the one-open-session-per-table rule stated as a storage-level guarantee rather than a procedural expectation? [Clarity, Spec §FR-007, Plan §Constitution VI]
- [ ] CHK012 - Are concurrent-entry requirements defined with the exact expected outcome (one session, both participants) and measurable success? [Acceptance Criteria, Spec §SC-003]
- [ ] CHK013 - Are the session states and their transitions fully enumerated with the actor of each transition? [Completeness, Spec §FR-005/FR-009/FR-010]
- [ ] CHK014 - Is the no-timeout rule stated so that any automatic transition (expiry, deactivation force-close) is definitively excluded? [Clarity, Spec §FR-008, SC-006]
- [ ] CHK015 - Are close-permission requirements consistent across the spec and the role model (owner/manager/cashier; kitchen denied; other branches denied)? [Consistency, Spec §FR-009/FR-019]
- [ ] CHK016 - Is the terminality of closed sessions specified for every affected path (no reopen, no round attachment, table re-eligibility)? [Coverage, Spec §FR-010]
- [ ] CHK017 - Are audit requirements for the close action specified with actor, time, resource, change, and scope fields? [Completeness, Spec §FR-018]
- [ ] CHK018 - Are the edge cases (table stopped mid-session, device loses token, same person re-enters) each addressed by a requirement rather than only a narrative? [Coverage, Spec §Edge Cases, Gap]
- [ ] CHK019 - Is retention of participant data (names, phones) stated with a defined posture and its boundary (what this phase does not build)? [Clarity, Spec §Clarifications, Key Entities]
- [ ] CHK020 - Are the entry validation bounds (name length, phone shape) quantified and consistently referenced by the acceptance scenarios? [Measurability, Spec §FR-004]

## Notes

- Defaults used (documented per the checklist skill): Depth Standard, Audience Reviewer, Focus: the top-2 relevance clusters — access security (Risk 5) and lifecycle/concurrency (Risk 7).
- `checklists/requirements.md` (the built-in spec-quality checklist) is separate and all-`[x]`.
