import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, createDbClient } from './helpers/db'
import {
  authUserIds,
  branchIds,
  membershipIds,
  profileIds,
  restaurantIds,
  seedBranches,
  seedMemberships,
} from './helpers/fixtures'

/**
 * Staff management suite (spec 004 US4: FR-013–FR-016, FR-020, FR-022;
 * SC-002/SC-003/SC-006; contracts/database-functions.md "Staff operations";
 * research.md §4–§6).
 *
 * Provisioning, linking, and membership mutation run through the real
 * `security definer` functions as simulated identities (the data API's
 * Postgres role + `request.jwt.claims`, per helpers/db.ts) inside transactions
 * that are ALWAYS rolled back — the shared cloud development database keeps no
 * test residue, `auth.users`/`auth.identities` included.
 *
 * Audit rows have no client grants by design (FR-020), so every audit
 * assertion reads them through the owner connection inside the same
 * transaction. Credentials are asserted to be STORED ONLY AS A BCRYPT HASH —
 * the plaintext returned by `add_staff_member` is never recoverable from the
 * database.
 *
 * Preconditions: migrated + seeded cloud dev DB (`npm run db:migrate &&
 * npm run db:seed`).
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

const ADD = 'select public.add_staff_member($1, $2, $3, $4, $5)'
const UPDATE = 'select * from public.update_staff_membership($1, $2, $3)'
const REMOVE = 'select public.remove_staff_membership($1)'

/** A person who exists in no seeded fixture — the new-person path. */
const NEW_PERSON_EMAIL = 'scratch-newcomer@restopilot.dev'
/** An auth identity deliberately left without a linked profile (unclaimed stub). */
const STUB_EMAIL = 'scratch-stub@restopilot.dev'

const blueOliveBranches = seedBranches
  .filter((branch) => branch.restaurant_id === restaurantIds.blueOlive)
  .map(({ id, name }) => ({ id, name }))
  .sort((a, b) => a.id.localeCompare(b.id))

interface AddedStaffMember {
  membership: {
    id: string
    profile_id: string
    restaurant_id: string
    role: string
    branch_id: string | null
  }
  profile_id: string
  person_created: boolean
  temporary_password: string | null
}

/**
 * Assert the call fails with the given SQLSTATE and a message containing
 * `messagePart`. The attempt runs inside a savepoint rolled back to it, so the
 * enclosing identity block continues at the pre-attempt state — exactly what
 * the no-state-change assertions then verify.
 */
async function expectRpcFailure(
  code: string,
  messagePart: string,
  sql: string,
  values: unknown[] = [],
): Promise<void> {
  await client.query('savepoint expect_staff_failure')
  try {
    await client.query(sql, values)
  } catch (error) {
    await client.query('rollback to savepoint expect_staff_failure')
    const pgError = error as { code?: string; message: string }
    if (pgError.code !== code) {
      throw new Error(`Expected ${code} but got ${pgError.code ?? 'no code'}: ${pgError.message}`, {
        cause: error,
      })
    }
    expect(pgError.message).toContain(messagePart)
    return
  }
  await client.query('rollback to savepoint expect_staff_failure')
  throw new Error(`Expected the call to fail with ${code} but it succeeded: ${sql}`)
}

/** The full staff membership set of a restaurant, ordered as the owner connection returns it. */
async function membershipsOf(restaurantId: string) {
  const { rows } = await client.query(
    `select id, profile_id, restaurant_id, role, branch_id
     from public.staff_memberships where restaurant_id = $1 order by id`,
    [restaurantId],
  )
  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Provisioning and linking (FR-013, FR-014)
// ─────────────────────────────────────────────────────────────────────────────

describe('staff provisioning and linking (FR-013/FR-014)', () => {
  it(
    'a new email provisions identity + profile + membership and returns a one-time credential stored only as a bcrypt hash',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query(ADD, [
          restaurantIds.blueOlive,
          NEW_PERSON_EMAIL,
          'Nadia Newcomer',
          'cashier',
          branchIds.marina,
        ])
        const added = rows[0].add_staff_member as AddedStaffMember

        expect(added.person_created).toBe(true)
        expect(added.membership).toMatchObject({
          restaurant_id: restaurantIds.blueOlive,
          role: 'cashier',
          branch_id: branchIds.marina,
        })
        expect(added.profile_id).toBe(added.membership.profile_id)
        // The credential is a fresh hex secret returned exactly once.
        expect(added.temporary_password).toMatch(/^[0-9a-f]{24}$/)

        // The identity, the linked profile, and the membership all exist.
        await client.query('set local role postgres')
        const identity = await client.query(
          `select id, email, encrypted_password, email_confirmed_at,
                  confirmation_token, recovery_token
           from auth.users where email = $1`,
          [NEW_PERSON_EMAIL],
        )
        expect(identity.rows).toHaveLength(1)
        expect(identity.rows[0]).toMatchObject({
          email: NEW_PERSON_EMAIL,
          // The five token columns are EMPTY STRINGS, never NULL (the
          // feature-003 insert contract — NULL breaks sign-in).
          confirmation_token: '',
          recovery_token: '',
        })
        expect(identity.rows[0].email_confirmed_at).not.toBeNull()

        // Stored as a bcrypt hash of the returned secret — never recoverable
        // as plaintext.
        const matches = await client.query(
          `select encrypted_password = extensions.crypt($1, encrypted_password) as ok,
                  encrypted_password = $1 as plaintext_stored
           from auth.users where email = $2`,
          [added.temporary_password, NEW_PERSON_EMAIL],
        )
        expect(matches.rows[0]).toEqual({ ok: true, plaintext_stored: false })

        const provider = await client.query(
          `select i.provider, i.provider_id from auth.identities i
           join auth.users u on u.id = i.user_id where u.email = $1`,
          [NEW_PERSON_EMAIL],
        )
        expect(provider.rows).toEqual([{ provider: 'email', provider_id: identity.rows[0].id }])

        const profile = await client.query(
          `select p.display_name, p.auth_user_id, p.is_super_admin
           from public.profiles p where p.id = $1`,
          [added.profile_id],
        )
        expect(profile.rows).toEqual([
          {
            display_name: 'Nadia Newcomer',
            auth_user_id: identity.rows[0].id,
            is_super_admin: false,
          },
        ])
      })
    },
  )

  it(
    'an existing linked person is linked with no credential and no display-name overwrite',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Bob is seeded as Blue Olive branch_manager at Downtown; a cashier
        // membership at Marina is a distinct membership for the same person.
        const { rows } = await client.query(ADD, [
          restaurantIds.blueOlive,
          'bob@restopilot.dev',
          'A Name That Must Not Win',
          'cashier',
          branchIds.marina,
        ])
        const added = rows[0].add_staff_member as AddedStaffMember

        expect(added.person_created).toBe(false)
        expect(added.temporary_password).toBeNull()
        expect(added.profile_id).toBe(profileIds.bob)

        await client.query('set local role postgres')
        // The profile keeps its own display name — linking never overwrites it.
        const profile = await client.query(
          `select display_name from public.profiles where id = $1`,
          [profileIds.bob],
        )
        expect(profile.rows).toEqual([{ display_name: 'Bob' }])
        // Both memberships coexist for the same person.
        const bobMemberships = await client.query(
          `select role, branch_id from public.staff_memberships
           where profile_id = $1 and restaurant_id = $2 order by role, branch_id`,
          [profileIds.bob, restaurantIds.blueOlive],
        )
        expect(new Set(bobMemberships.rows.map((row) => `${row.role}:${row.branch_id}`))).toEqual(
          new Set(['branch_manager:' + branchIds.downtown, 'cashier:' + branchIds.marina]),
        )
      })
    },
  )

  it(
    'an unclaimed stub (identity without a profile) gains a profile and a re-issued credential',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // The stub is created inside THIS transaction — an identity with no
        // linked profile, exactly what an interrupted provisioning or a
        // post-reset orphan leaves behind. Keeping the insert here is what
        // makes the suite leave no residue: the rollback removes it too.
        await client.query('set local role postgres')
        await client.query(
          `insert into auth.users (
             id, instance_id, aud, role, email, encrypted_password,
             email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
             confirmation_token, recovery_token, email_change,
             email_change_token_new, email_change_token_current, created_at, updated_at
           ) values (
             gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
             'authenticated', 'authenticated', $1, null,
             now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
             '', '', '', '', '', now(), now()
           )`,
          [STUB_EMAIL],
        )
        await client.query('set local role authenticated')

        const { rows } = await client.query(ADD, [
          restaurantIds.blueOlive,
          STUB_EMAIL,
          'Stub Claimed',
          'kitchen',
          branchIds.marina,
        ])
        const added = rows[0].add_staff_member as AddedStaffMember

        // The person already existed (person_created = false) yet a credential
        // WAS issued — the return shape the UI message keys off.
        expect(added.person_created).toBe(false)
        expect(added.temporary_password).toMatch(/^[0-9a-f]{24}$/)

        await client.query('set local role postgres')
        const linked = await client.query(
          `select p.id, p.display_name, p.auth_user_id
           from public.profiles p
           join auth.users u on u.id = p.auth_user_id
           where u.email = $1`,
          [STUB_EMAIL],
        )
        expect(linked.rows).toHaveLength(1)
        expect(linked.rows[0]).toMatchObject({ display_name: 'Stub Claimed' })

        const credential = await client.query(
          `select encrypted_password = extensions.crypt($1, encrypted_password) as ok
           from auth.users where email = $2`,
          [added.temporary_password, STUB_EMAIL],
        )
        expect(credential.rows).toEqual([{ ok: true }])
      })
    },
  )

  it(
    'a person may hold memberships in several restaurants (multi-membership)',
    { timeout: 30_000 },
    async () => {
      // Eve owns Cedar Grill and is a Downtown cashier; adding her as kitchen
      // in Blue Olive's Marina is a third, legitimate membership.
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query(ADD, [
          restaurantIds.blueOlive,
          'eve@restopilot.dev',
          'Eve',
          'kitchen',
          branchIds.marina,
        ])
        const added = rows[0].add_staff_member as AddedStaffMember
        expect(added.person_created).toBe(false)
        expect(added.temporary_password).toBeNull()

        await client.query('set local role postgres')
        const { rows: all } = await client.query(
          `select restaurant_id, role from public.staff_memberships where profile_id = $1`,
          [profileIds.eve],
        )
        expect(all).toHaveLength(3)
        expect(new Set(all.map((row) => `${row.restaurant_id}:${row.role}`))).toEqual(
          new Set([
            `${restaurantIds.cedarGrill}:owner`,
            `${restaurantIds.blueOlive}:cashier`,
            `${restaurantIds.blueOlive}:kitchen`,
          ]),
        )
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Role/branch consistency and duplicate rules (FR-013, FR-015, SC-003)
// ─────────────────────────────────────────────────────────────────────────────

describe('role/branch consistency and duplicate rules (FR-013/FR-015, SC-003)', () => {
  it(
    'an owner with a branch is rejected, and a branch-scoped role without one is rejected',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure(
          'P0001',
          'Owners are restaurant-wide and must not have a branch.',
          ADD,
          [
            restaurantIds.blueOlive,
            NEW_PERSON_EMAIL,
            'Owner With Branch',
            'owner',
            branchIds.marina,
          ],
        )

        for (const role of ['branch_manager', 'cashier', 'kitchen']) {
          await expectRpcFailure(
            'P0001',
            'Select a branch of this restaurant for this role.',
            ADD,
            [restaurantIds.blueOlive, NEW_PERSON_EMAIL, 'No Branch', role, null],
          )
        }

        // Nothing was provisioned and no membership exists for the person.
        await client.query('set local role postgres')
        const identity = await client.query(`select id from auth.users where email = $1`, [
          NEW_PERSON_EMAIL,
        ])
        expect(identity.rows).toEqual([])
        const audit = await client.query(
          `select count(*)::int as n from public.audit_log
           where actor_profile_id = $1 and action = 'staff.added'`,
          [profileIds.alice],
        )
        expect(audit.rows[0].n).toBe(0)
      })
    },
  )

  it(
    'a branch of another restaurant is rejected for a branch-scoped role',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Airport belongs to Cedar Grill.
        await expectRpcFailure('P0001', 'Select a branch of this restaurant for this role.', ADD, [
          restaurantIds.blueOlive,
          NEW_PERSON_EMAIL,
          'Cross Tenant',
          'cashier',
          branchIds.airport,
        ])

        await client.query('set local role postgres')
        const identity = await client.query(`select id from auth.users where email = $1`, [
          NEW_PERSON_EMAIL,
        ])
        expect(identity.rows).toEqual([])
      })
    },
  )

  it(
    'blank/invalid email and blank display name are rejected with nothing created',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'A valid email address is required.', ADD, [
          restaurantIds.blueOlive,
          '   ',
          'No Email',
          'cashier',
          branchIds.marina,
        ])
        await expectRpcFailure('P0001', 'A valid email address is required.', ADD, [
          restaurantIds.blueOlive,
          'not-an-email',
          'Bad Email',
          'cashier',
          branchIds.marina,
        ])
        await expectRpcFailure('P0001', 'A valid email address is required.', ADD, [
          restaurantIds.blueOlive,
          'two@at@restopilot.dev',
          'Bad Email',
          'cashier',
          branchIds.marina,
        ])
        await expectRpcFailure('P0001', 'A display name is required.', ADD, [
          restaurantIds.blueOlive,
          NEW_PERSON_EMAIL,
          '   ',
          'cashier',
          branchIds.marina,
        ])

        await client.query('set local role postgres')
        const identity = await client.query(`select id from auth.users where email = $1`, [
          NEW_PERSON_EMAIL,
        ])
        expect(identity.rows).toEqual([])
      })
    },
  )

  it(
    'an exact duplicate membership is rejected on add and on update, while a distinct role or branch stays valid',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Bob already holds branch_manager @ Downtown.
        await expectRpcFailure('P0001', 'This person already holds this exact membership.', ADD, [
          restaurantIds.blueOlive,
          'bob@restopilot.dev',
          'Bob',
          'branch_manager',
          branchIds.downtown,
        ])
        // Carla already holds cashier @ Downtown; the same role on another
        // branch is a distinct membership.
        await expectRpcFailure('P0001', 'This person already holds this exact membership.', ADD, [
          restaurantIds.blueOlive,
          'carla@restopilot.dev',
          'Carla',
          'cashier',
          branchIds.downtown,
        ])
        const { rows } = await client.query(ADD, [
          restaurantIds.blueOlive,
          'carla@restopilot.dev',
          'Carla',
          'cashier',
          branchIds.marina,
        ])
        expect((rows[0].add_staff_member as AddedStaffMember).person_created).toBe(false)

        // On update: moving Carla's Marina shift to Downtown collides with her
        // existing Downtown cashier membership.
        await client.query('set local role postgres')
        const carlaMarina = await client.query(
          `select id from public.staff_memberships
           where profile_id = $1 and restaurant_id = $2 and role = 'cashier' and branch_id = $3`,
          [profileIds.carla, restaurantIds.blueOlive, branchIds.marina],
        )
        await client.query('set local role authenticated')
        await expectRpcFailure(
          'P0001',
          'This person already holds this exact membership.',
          UPDATE,
          [carlaMarina.rows[0].id, 'cashier', branchIds.downtown],
        )
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Last-owner safeguard (FR-016)
// ─────────────────────────────────────────────────────────────────────────────

describe('last-owner safeguard (FR-016)', () => {
  it(
    'removing the restaurant’s only owner is rejected and the restaurant still holds its owner',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'A restaurant always keeps at least one owner.', REMOVE, [
          membershipIds.aliceOwnerBlueOlive,
        ])

        await client.query('set local role postgres')
        const owners = await client.query(
          `select id from public.staff_memberships
           where restaurant_id = $1 and role = 'owner' order by id`,
          [restaurantIds.blueOlive],
        )
        expect(owners.rows).toEqual([{ id: membershipIds.aliceOwnerBlueOlive }])
        const audit = await client.query(
          `select count(*)::int as n from public.audit_log
           where actor_profile_id = $1 and action = 'staff.removed'`,
          [profileIds.alice],
        )
        expect(audit.rows[0].n).toBe(0)
      })
    },
  )

  it(
    'demoting the only owner is rejected, and the safeguard lifts once a second owner exists',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'A restaurant always keeps at least one owner.', UPDATE, [
          membershipIds.aliceOwnerBlueOlive,
          'branch_manager',
          branchIds.downtown,
        ])

        // Add a second owner: the demotion is now legitimate (FR-016 is an
        // invariant, not a prohibition).
        const { rows } = await client.query(ADD, [
          restaurantIds.blueOlive,
          'dan@restopilot.dev',
          'Dan',
          'owner',
          null,
        ])
        const secondOwner = (rows[0].add_staff_member as AddedStaffMember).membership.id

        const demoted = await client.query(UPDATE, [
          membershipIds.aliceOwnerBlueOlive,
          'branch_manager',
          branchIds.downtown,
        ])
        expect(demoted.rows[0]).toMatchObject({
          id: membershipIds.aliceOwnerBlueOlive,
          role: 'branch_manager',
          branch_id: branchIds.downtown,
        })

        await client.query('set local role postgres')
        const owners = await client.query(
          `select id from public.staff_memberships
           where restaurant_id = $1 and role = 'owner' order by id`,
          [restaurantIds.blueOlive],
        )
        expect(owners.rows).toEqual([{ id: secondOwner }])
      })
    },
  )

  it(
    'removal ends access while the person (identity and profile) persists, so they can be re-added',
    { timeout: 30_000 },
    async () => {
      // Dan loses his Marina kitchen membership; his identity and profile stay.
      await asUser(client, authUserIds.alice, async () => {
        await client.query(REMOVE, [membershipIds.danKitchenMarina])

        await client.query('set local role postgres')
        const memberships = await client.query(
          `select id from public.staff_memberships where id = $1`,
          [membershipIds.danKitchenMarina],
        )
        expect(memberships.rows).toEqual([])
        const person = await client.query(
          `select p.id, u.id as auth_user_id from public.profiles p
           join auth.users u on u.id = p.auth_user_id where p.id = $1`,
          [profileIds.dan],
        )
        expect(person.rows).toHaveLength(1)

        // Re-adding the same person links the surviving identity — no new
        // person, no credential.
        await client.query('set local role authenticated')
        const readded = await client.query(ADD, [
          restaurantIds.blueOlive,
          'dan@restopilot.dev',
          'Dan',
          'kitchen',
          branchIds.marina,
        ])
        const added = readded.rows[0].add_staff_member as AddedStaffMember
        expect(added.person_created).toBe(false)
        expect(added.temporary_password).toBeNull()
        expect(added.profile_id).toBe(profileIds.dan)
      })
    },
  )

  it(
    'a removed membership’s audit record survives the deletion (written in the same transaction)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await client.query(REMOVE, [membershipIds.carlaCashierDowntown])

        await client.query('set local role postgres')
        const audit = await client.query(
          `select actor_profile_id, action, resource_type, resource_id, reason,
                  restaurant_id, branch_id
           from public.audit_log
           where action = 'staff.removed' and resource_id = $1`,
          [membershipIds.carlaCashierDowntown],
        )
        expect(audit.rows).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'staff.removed',
            resource_type: 'staff_membership',
            resource_id: membershipIds.carlaCashierDowntown,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.downtown,
          },
        ])
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Authorization matrix (FR-006, FR-015, SC-002)
// ─────────────────────────────────────────────────────────────────────────────

describe('staff operation authorization matrix (FR-006/FR-015, SC-002)', () => {
  const nonOwners: ReadonlyArray<{
    label: string
    authUserId: string
    profileId: string
    /** False only for Eve: she owns Cedar Grill, so its membership is hers to change. */
    includeOtherTenant: boolean
  }> = [
    {
      label: 'branch manager (Bob, Downtown)',
      authUserId: authUserIds.bob,
      profileId: profileIds.bob,
      includeOtherTenant: true,
    },
    {
      label: 'cashier (Carla, Downtown)',
      authUserId: authUserIds.carla,
      profileId: profileIds.carla,
      includeOtherTenant: true,
    },
    {
      label: 'kitchen (Dan, Marina)',
      authUserId: authUserIds.dan,
      profileId: profileIds.dan,
      includeOtherTenant: true,
    },
    {
      label: 'other restaurant owner (Eve, Cedar Grill) acting on Blue Olive',
      authUserId: authUserIds.eve,
      profileId: profileIds.eve,
      includeOtherTenant: false,
    },
    {
      label: 'super admin (platform admin)',
      authUserId: authUserIds.platformAdmin,
      profileId: profileIds.platformAdmin,
      includeOtherTenant: true,
    },
  ]

  for (const identity of nonOwners) {
    it(
      `${identity.label} is denied 42501 on every staff operation with no state change and no staff audit record`,
      { timeout: 30_000 },
      async () => {
        const membershipTargets = [
          membershipIds.bobManagerDowntown,
          membershipIds.carlaCashierDowntown,
          ...(identity.includeOtherTenant ? [membershipIds.eveOwnerCedarGrill] : []),
        ]

        await asUser(client, identity.authUserId, async () => {
          await expectRpcFailure('42501', 'do not have permission', ADD, [
            restaurantIds.blueOlive,
            NEW_PERSON_EMAIL,
            'Hijacked',
            'cashier',
            branchIds.marina,
          ])
          // A nonexistent target resolves no restaurant and is denied alike.
          await expectRpcFailure('42501', 'do not have permission', ADD, [
            '00000000-0000-4000-8000-00000000dead',
            NEW_PERSON_EMAIL,
            'Hijacked',
            'cashier',
            branchIds.marina,
          ])
          for (const membershipId of membershipTargets) {
            await expectRpcFailure('42501', 'do not have permission', UPDATE, [
              membershipId,
              'owner',
              null,
            ])
            await expectRpcFailure('42501', 'do not have permission', REMOVE, [membershipId])
          }
          await expectRpcFailure('42501', 'do not have permission', UPDATE, [
            '00000000-0000-4000-8000-00000000dead',
            'owner',
            null,
          ])
          await expectRpcFailure('42501', 'do not have permission', REMOVE, [
            '00000000-0000-4000-8000-00000000dead',
          ])

          // No state change: the seeded memberships are byte-for-byte the
          // fixture set, and no person was provisioned.
          await client.query('set local role postgres')
          const blueOliveMemberships = await membershipsOf(restaurantIds.blueOlive)
          expect(blueOliveMemberships).toEqual(
            seedMemberships
              .filter((membership) => membership.restaurant_id === restaurantIds.blueOlive)
              .map(({ id, profile_id, restaurant_id, role, branch_id }) => ({
                id,
                profile_id,
                restaurant_id,
                role,
                branch_id,
              }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          )
          const provisioned = await client.query(`select id from auth.users where email = $1`, [
            NEW_PERSON_EMAIL,
          ])
          expect(provisioned.rows).toEqual([])
          const audit = await client.query(
            `select count(*)::int as n from public.audit_log
             where actor_profile_id = $1 and action like 'staff.%'`,
            [identity.profileId],
          )
          expect(audit.rows[0].n).toBe(0)
        })
      },
    )
  }

  it(
    'anon is denied 42501 on every staff operation (execute is authenticated-only)',
    { timeout: 30_000 },
    async () => {
      await asAnon(client, async () => {
        await expectRpcFailure('42501', 'permission denied', ADD, [
          restaurantIds.blueOlive,
          NEW_PERSON_EMAIL,
          'Anon',
          'cashier',
          branchIds.marina,
        ])
        await expectRpcFailure('42501', 'permission denied', UPDATE, [
          membershipIds.bobManagerDowntown,
          'owner',
          null,
        ])
        await expectRpcFailure('42501', 'permission denied', REMOVE, [
          membershipIds.bobManagerDowntown,
        ])
      })
    },
  )

  it(
    'the provisioning helper is callable by no client role (it is not a client API)',
    { timeout: 30_000 },
    async () => {
      const CALL_PROVISION = 'select * from private.provision_staff_identity($1, $2)'
      await asAnon(client, async () => {
        await expectRpcFailure('42501', 'permission denied', CALL_PROVISION, [
          'scratch-direct@restopilot.dev',
          'Direct',
        ])
      })
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('42501', 'permission denied', CALL_PROVISION, [
          'scratch-direct@restopilot.dev',
          'Direct',
        ])
      })
    },
  )

  it(
    'the owner of the other restaurant (Eve) may manage her own staff — the denial is ownership-scoped (control)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.eve, async () => {
        const { rows } = await client.query(ADD, [
          restaurantIds.cedarGrill,
          NEW_PERSON_EMAIL,
          'Cedar Newcomer',
          'cashier',
          branchIds.airport,
        ])
        const added = rows[0].add_staff_member as AddedStaffMember
        expect(added.person_created).toBe(true)
        expect(added.membership).toMatchObject({
          restaurant_id: restaurantIds.cedarGrill,
          role: 'cashier',
          branch_id: branchIds.airport,
        })
      })
    },
  )

  it(
    'the branch list a staff read resolves stays policy-scoped (no widening from this phase)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.bob, async () => {
        const { rows } = await client.query(`select id, name from public.branches order by id`)
        expect(rows).toEqual([{ id: branchIds.downtown, name: 'Downtown' }])
        // The owner sees both of the restaurant's branches (control).
        expect(blueOliveBranches).toHaveLength(2)
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Staff audit records (FR-020, SC-006)
// ─────────────────────────────────────────────────────────────────────────────

describe('staff audit records (FR-020, SC-006) — asserted through the owner connection', () => {
  it(
    'staff.added, staff.updated, and staff.removed carry actor, action, resource, tenant scope, and branch scope',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const added = (
          await client.query(ADD, [
            restaurantIds.blueOlive,
            NEW_PERSON_EMAIL,
            'Audited Person',
            'cashier',
            branchIds.marina,
          ])
        ).rows[0].add_staff_member as AddedStaffMember
        const membershipId = added.membership.id

        await client.query(UPDATE, [membershipId, 'kitchen', branchIds.marina])
        await client.query(REMOVE, [membershipId])

        await client.query('set local role postgres')
        const audit = await client.query(
          `select actor_profile_id, action, resource_type, resource_id, reason,
                  restaurant_id, branch_id
           from public.audit_log
           where resource_id = $1 and action like 'staff.%'
           order by id`,
          [membershipId],
        )
        expect(audit.rows).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'staff.added',
            resource_type: 'staff_membership',
            resource_id: membershipId,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.marina,
          },
          {
            actor_profile_id: profileIds.alice,
            action: 'staff.updated',
            resource_type: 'staff_membership',
            resource_id: membershipId,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.marina,
          },
          {
            actor_profile_id: profileIds.alice,
            action: 'staff.removed',
            resource_type: 'staff_membership',
            resource_id: membershipId,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.marina,
          },
        ])
      })
    },
  )

  it(
    'a restaurant-wide (owner) membership records no branch scope, and a rejected operation records nothing',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const added = (
          await client.query(ADD, [
            restaurantIds.blueOlive,
            NEW_PERSON_EMAIL,
            'Second Owner',
            'owner',
            null,
          ])
        ).rows[0].add_staff_member as AddedStaffMember

        // A rejected duplicate writes no audit record.
        await expectRpcFailure('P0001', 'already holds this exact membership', ADD, [
          restaurantIds.blueOlive,
          NEW_PERSON_EMAIL,
          'Second Owner',
          'owner',
          null,
        ])

        await client.query('set local role postgres')
        const audit = await client.query(
          `select action, resource_id, branch_id, restaurant_id
           from public.audit_log
           where action like 'staff.%' and restaurant_id = $1 and resource_id = $2`,
          [restaurantIds.blueOlive, added.membership.id],
        )
        // Exactly one record: the accepted add. The owner role carries no
        // branch scope; the rejected duplicate added nothing.
        expect(audit.rows).toEqual([
          {
            action: 'staff.added',
            resource_id: added.membership.id,
            branch_id: null,
            restaurant_id: restaurantIds.blueOlive,
          },
        ])
      })
    },
  )
})
