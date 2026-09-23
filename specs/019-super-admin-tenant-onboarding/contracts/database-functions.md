# Contract: database functions — Super-Admin Tenant Onboarding

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](plan.md)

## §1 The new console RPC

### `onboard_restaurant`

```
create function public.onboard_restaurant(
  p_name              text,
  p_slug              text,
  p_owner_email       text,
  p_owner_display_name text,
  p_brand_description text default null,
  p_contact_email     text default null,
  p_contact_phone     text default null,
  p_timezone          text default 'UTC'
) returns jsonb
volatile, security definer, set search_path = ''
```

- **Guard** (first statement, before any validation): the caller resolves
  through `private.ops_profile_id()` and must satisfy
  `private.is_super_admin_profile`; otherwise
  `raise exception 'You do not have permission to view the platform console.' using errcode = '42501'`
  — identical to the 014 console refusals, indistinguishable from any other
  denial.
- **Execution order** (one transaction, all-or-nothing):
  1. `private.validate_tenant_inputs(...)` — the shared rulebook (R2).
  2. insert `restaurants` (conflict on slug ⇒ the established verbatim
     message; caught by constraint name like the management RPCs).
  3. `private.provision_staff_identity(p_owner_email, p_owner_display_name)`
     — unchanged (R1).
  4. insert `staff_memberships` (role 'owner', branch_id null) — the
     `staff_memberships_no_duplicates` index fails a concurrent duplicate
     closed (constraint caught ⇒ verbatim re-raise).
  5. insert `subscriptions` (restaurant_id) — `never_activated` (FR-008a).
  6. insert `audit_log` — action `'platform.restaurant_onboarded'`,
     reason `'first owner provisioned'` when `person_created` or a
     credential was (re-)issued, else `'first owner linked'` (FR-006/R5).
- **Returns** (jsonb):

```json
{
  "restaurant_id": "…",
  "name": "…",
  "slug": "…",
  "owner": {
    "profile_id": "…",
    "email": "…",
    "temporary_password": "12-byte hex | null",
    "outcome": "provisioned | linked"
  }
}
```

- `temporary_password` non-null ⟺ a credential was issued (new person or
  completed stub); null for a linked existing person. The credential is
  returned exactly once by this RPC and handled by the client per the
  staff-panel discipline (display once, never logged/persisted).

## §2 The extracted shared helper (refactor — behavior preserved)

### `private.validate_tenant_inputs`

```
create function private.validate_tenant_inputs(
  p_name text, p_slug text, p_brand_description text,
  p_contact_email text, p_contact_phone text, p_timezone text
) returns table (v_name text, v_slug text, v_brand_description text,
                 v_contact_email text, v_contact_phone text, v_timezone text)
```

- Contains, verbatim, the validation currently inside `create_restaurant`
  (name/slug shape + slug-conflict pre-check + brand/contact bounds +
  timezone rules, messages unchanged — migration 20260916174016 lines
  72–82 and their neighbors).
- `create_restaurant` is rewritten to call this helper and keep EVERYTHING
  else identical (its 42501 unlinked-identity denial, its membership
  bootstrap, its audit behavior). The standing management + security
  suites are its regression proof.

## §3 Refusal vocabulary (verbatim, one rulebook)

| Condition | Message | Code |
|---|---|---|
| non-super-admin / unauthenticated | `You do not have permission to view the platform console.` | 42501 |
| slug already in use | `This public identifier is already in use by another restaurant.` | P0001 (constraint/pre-check, as today) |
| malformed identifier / empty required field / bad timezone | the exact messages `create_restaurant` raises today | P0001 |
| owner email already exists (race) | `A person with this email address already exists.` | P0001 |
| duplicate membership (race) | the management RPCs' duplicate-membership message | P0001 |

The failure-mode rule is unchanged: SQLSTATEs are caught BY CONSTRAINT NAME
inside the RPCs and re-raised with user-facing messages; raw SQLSTATEs
never reach the client.

## §4 Grants

- `onboard_restaurant`: `execute` to `authenticated` only (grant), revoked
  from `public`/`anon` — the 014 console convention, probed in its tests.
- `validate_tenant_inputs`: private schema — no grants, not callable by
  clients (same as every private helper).

## §5 Client module additions (`src/features/platform/platformClient.ts`)

- `onboardRestaurant(input): Promise<PlatformResult<OnboardedTenant>>` —
  the module's existing `settle`/error-mapping shape; `P0001` messages
  verbatim, `42501` as the module's denial notice.
- `useOnboardRestaurant()` — mutation; onSuccess invalidates
  `platformOverviewKey()` (US3's immediate visibility).
- `OnboardingPanel` — the form + one-time credential display; server
  messages verbatim; form state preserved on refusal; the credential
  cleared on the next action (the `IssuedCredential` pattern).
