# Data Model: Self-Service Password Change (020)

**Feature**: [spec.md](spec.md) · Created 2026-09-23

**No schema changes. No new tables, columns, RPCs, or policies.** The feature
operates entirely on the platform's authentication layer through the existing
`authClient` module. Recorded here: the entities the flow touches and the
invariants it must preserve.

## Entities touched

### Account (authentication identity) — *modified credential only*

| Aspect | Before change | After change |
|---|---|---|
| Sign-in password | old | new (old permanently dead for fresh sign-ins) |
| Auth identity (`auth.users` row id, email) | unchanged | unchanged |
| Linked profile (`profiles` row) | unchanged | unchanged — display name, `is_super_admin` |
| Memberships (`staff_memberships`) | unchanged | unchanged — restaurants, roles, branches |
| Sessions | this record + others | this record valid; every other record invalidated |

**Integrity invariant (SC-003)**: an authorization snapshot
(profile fields + full membership set) taken immediately before the change must
equal one taken after — byte-identical. Proven by the integration suite.

### Session (platform session record) — *the semantics the client must respect*

- One record per **independent sign-in**; a device profile's tabs share its stored
  record.
- The **initiating** record (the one performing `updateUser`) survives unchanged —
  no rotation, no re-authentication.
- Every **other** record: refresh token revoked; next authenticated action denied.
- The client performs **no token operations** (no `setSession`, no refresh calls, no
  storage writes) as part of this feature.

### Password change (operation) — *transient, no persistence*

```text
inputs:  currentPassword (proof), newPassword, confirmation (UX only)
states:  idle → verifying (sign-in attempt) → applying (credential update)
         → succeeded | failed(distinct | generic)
         → idle (retry allowed — FR-011)
```

- Nothing about the operation is persisted client-side; a page refresh returns the
  form to `idle` (edge case honored by construction).
- Confirmation mismatch resolves **locally** in `idle` — no platform call (FR-005).

## State transitions (page-level)

| From | Event | To | Guarantees |
|---|---|---|---|
| any | submit with mismatched confirmation | failed (local) | no platform call; local mismatch message |
| idle | submit (valid shape) | verifying | form disabled (FR-011) |
| verifying | sign-in attempt fails | failed (distinct message) | password untouched |
| verifying | sign-in attempt succeeds | applying | — |
| applying | update fails (policy/session/network) | failed (generic message) | current password still active |
| applying | update succeeds | succeeded | confirmation states both session facts (FR-007) |
| succeeded / failed | user edits & resubmits | idle → verifying | flow re-usable immediately (FR-011) |
| any | session expires during flight | failed (generic) | existing signed-out handling proceeds (FR-012) |

## Error-message vocabulary (the complete set)

| Message constant | Trigger | Note |
|---|---|---|
| `CURRENT_PASSWORD_FAILURE_MESSAGE` (new) | sign-in verification attempt fails | the ONLY distinct message (FR-006, clarify "A") |
| `PASSWORD_RESET_FAILURE_MESSAGE` (existing, reused) | update step fails for any reason | house discipline; already exists in `authClient` |
| local "The two passwords do not match." | confirmation mismatch | same wording as the recovery page |
