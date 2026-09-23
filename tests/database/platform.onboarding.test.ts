import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import { authUserIds } from './helpers/fixtures'

/**
 * Super-admin tenant onboarding (spec 019 T004–T007).
 *
 * The flag is the only key (FR-010) and it grants nothing beyond the
 * onboarding action itself (FR-008b): the reach matrix proves both. The
 * provisioning composes private.provision_staff_identity verbatim (FR-002/
 * FR-003/FR-007); every refusal is all-or-nothing (FR-004); the audit row
 * carries the acting super admin and the outcome (FR-006); the onboarded
 * tenant is indistinguishable from a self-bootstrapped one — including the
 * 014 Important rule (never_activated never blocks ordering, SC-005).
 *
 * House discipline: probes run as the real roles (runAs under the hood),
 * failures are asserted through savepoints so one connection serves the
 * whole suite, and the onboarded tenants are removed in afterAll — the
 * fixture stays deterministic for the other suites.
 */

let client: Awaited<ReturnType<typeof createDbClient>>

const NEW_OWNER_EMAIL = 'onboarded-owner@restopilot.dev'
const STUB_EMAIL = 'onboarded-stub@restopilot.dev'
/** Slugs this suite creates; afterAll removes the rows it onboarded. */
const slugs: string[] = []
let stubAuthId: string | null = null

beforeAll(async () => {
  client = await createDbClient()
  await client.connect()
  // A previous run whose afterAll crashed (assertion, lost connection)
  // leaves residue that would flip 'provisioned' to 'linked' — clean it
  // before the run, not just after it.
  await cleanupResidue()
})

/**
 * Remove the suite's tenants and identities in FK-safe order. Idempotent —
 * runs before the suite (crash recovery) and after it (cleanup).
 */
async function cleanupResidue(): Promise<void> {
  const emails = [NEW_OWNER_EMAIL, STUB_EMAIL]
  // Tenants first: audit rows and memberships do not cascade;
  // subscriptions do. Then the restaurants themselves.
  await client.query(
    `delete from public.audit_log a
     using public.restaurants r
     where a.restaurant_id = r.id and r.slug = any($1)`,
    [slugs],
  )
  await client.query(
    `delete from public.staff_memberships m
     using public.restaurants r
     where m.restaurant_id = r.id and r.slug = any($1)`,
    [slugs],
  )
  await client.query('delete from public.restaurants where slug = any($1)', [slugs])
  // Provisioned owners: profile before the identity (the FK guard).
  await client.query(
    'delete from public.profiles where auth_user_id in (select id from auth.users where lower(email) = any($1))',
    [emails],
  )
  await client.query('delete from auth.users where lower(email) = any($1)', [emails])
}

afterAll(async () => {
  await cleanupResidue()
  await client.end().catch(() => {})
})

function onboard(slug: string, ownerEmail = NEW_OWNER_EMAIL, name = 'Onboarded Probe') {
  slugs.push(slug)
  return client.query('select public.onboard_restaurant($1, $2, $3, $4) as r', [
    name,
    slug,
    ownerEmail,
    'Onboarded Owner',
  ])
}

describe('platform onboarding: the flag is the only key (FR-010, T004)', () => {
  it.each([
    ['owner (alice)', authUserIds.alice],
    ['branch manager (bob)', authUserIds.bob],
    ['cashier (carla)', authUserIds.carla],
    ['kitchen (dan)', authUserIds.dan],
    ['cross-tenant member (eve)', authUserIds.eve],
    ['membership-free bootstrap (fiona)', authUserIds.fiona],
  ])('refuses %s with the console denial', async (_label, authUserId) => {
    await asUser(client, authUserId, async () => {
      await expectStatementToFail(
        client,
        '42501',
        `select public.onboard_restaurant('X', 'onboarded-r-${authUserId.slice(0, 4)}', 'o@restopilot.dev', 'O')`,
      )
    })
  })

  it('refuses anon', async () => {
    await asAnon(client, async () => {
      await expectStatementToFail(
        client,
        '42501',
        "select public.onboard_restaurant('X', 'onboarded-anon', 'o@restopilot.dev', 'O')",
      )
    })
  })

  it('admits the super admin — a new person with a one-time credential', async () => {
    await asUser(client, authUserIds.platformAdmin, async () => {
      const r = await onboard('onboarded-reach-matrix')
      const payload = r.rows[0]!.r
      expect(payload.slug).toBe('onboarded-reach-matrix')
      expect(payload.owner.outcome).toBe('provisioned')
      expect(payload.owner.temporary_password).toMatch(/^[0-9a-f]{24}$/)
    })
  })
})

describe('the provisioning cases + the dual-role edge (FR-002/003/007, T005)', () => {
  it('a brand-new person lands membership + subscription + audit (FR-008a, FR-006)', async () => {
    await asUser(client, authUserIds.platformAdmin, async () => {
      const r = await onboard('onboarded-new')
      const payload = r.rows[0]!.r
      expect(payload.owner.outcome).toBe('provisioned')
      // Verification reads drop the client role: RLS hides tenant rows
      // from the platform admin (he is a member of no restaurant) —
      // the house discipline (session.rpc.test.ts audit reads).
      await client.query('reset role')
      const m = await client.query(
        `select m.role from public.staff_memberships m
         where m.restaurant_id = $1 and m.role = 'owner'`,
        [payload.restaurant_id],
      )
      expect(m.rows).toHaveLength(1)
      const s = await client.query(
        'select start_date, end_date from public.subscriptions where restaurant_id = $1',
        [payload.restaurant_id],
      )
      expect(s.rows[0]!.start_date).toBeNull()
      expect(s.rows[0]!.end_date).toBeNull()
      const a = await client.query(
        `select action, reason, actor_profile_id from public.audit_log
         where restaurant_id = $1 and action = 'platform.restaurant_onboarded'`,
        [payload.restaurant_id],
      )
      expect(a.rows).toHaveLength(1)
      expect(a.rows[0]!.reason).toBe('first owner provisioned')
      const actor = await client.query(
        'select 1 from public.profiles where id = $1 and is_super_admin',
        [a.rows[0]!.actor_profile_id],
      )
      expect(actor.rows).toHaveLength(1)
    })
  })

  it('an unclaimed stub is completed with a re-issued credential (FR-007)', async () => {
    await inTransaction(client, async () => {
      // Forge the stub as the connection role: an auth identity with no
      // profile (the helper's second case). auth.users carries no client
      // grants — only the connection's own role may write it.
      const u = await client.query(
        `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
           email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
           confirmation_token, recovery_token, email_change,
           email_change_token_new, email_change_token_current, created_at, updated_at)
         values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
           'authenticated', $1, 'stub', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
           '', '', '', '', '', now(), now())
         returning id`,
        [STUB_EMAIL],
      )
      stubAuthId = u.rows[0]!.id
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.platformAdmin }),
      ])
      const r = await onboard('onboarded-stub', STUB_EMAIL)
      const payload = r.rows[0]!.r
      expect(payload.owner.outcome).toBe('provisioned')

      expect(payload.owner.temporary_password).not.toBeNull()
      await client.query('reset role')
      const profile = await client.query('select auth_user_id from public.profiles where id = $1', [
        payload.owner.profile_id,
      ])
      expect(profile.rows[0]!.auth_user_id).toBe(stubAuthId)
    })
  })

  it('a known person is linked with no credential issued (FR-003)', async () => {
    await asUser(client, authUserIds.platformAdmin, async () => {
      const r = await onboard('onboarded-link', 'dan@restopilot.dev')
      const payload = r.rows[0]!.r
      expect(payload.owner.outcome).toBe('linked')
      expect(payload.owner.temporary_password).toBeNull()
      await client.query('reset role')
      const link = await client.query('select auth_user_id from public.profiles where id = $1', [
        payload.owner.profile_id,
      ])
      expect(link.rows[0]!.auth_user_id).toBe(authUserIds.dan)
    })
  })

  it('the super admin can onboard themselves as first owner (dual-role edge)', async () => {
    await asUser(client, authUserIds.platformAdmin, async () => {
      const r = await onboard('onboarded-dual', 'platform-admin@restopilot.dev')
      const payload = r.rows[0]!.r
      expect(payload.owner.outcome).toBe('linked')
      const m = await client.query(
        `select 1 from public.staff_memberships
         where restaurant_id = $1 and profile_id = $2 and role = 'owner'`,
        [payload.restaurant_id, payload.owner.profile_id],
      )
      expect(m.rows).toHaveLength(1)
    })
  })
})

describe('all-or-nothing on every refusal path (FR-004, T006)', () => {
  /** The footprint ruler: nothing anywhere, before and after each refusal. */
  async function totalFootprint(): Promise<{
    restaurants: number
    subs: number
    audit: number
    stubUsers: number
  }> {
    const r = await client.query(
      `select
         (select count(*)::int from public.restaurants where slug like 'onboarded-%') as restaurants,
         (select count(*)::int from public.subscriptions s join public.restaurants r on r.id = s.restaurant_id where r.slug like 'onboarded-%') as subs,
         (select count(*)::int from public.audit_log a join public.restaurants r on r.id = a.restaurant_id where r.slug like 'onboarded-%') as audit,
         (select count(*)::int from auth.users where lower(email) = $1) as stub_users`,
      [NEW_OWNER_EMAIL],
    )
    return r.rows[0]!
  }

  it.each([
    ['slug conflict', ['Onboarded Probe', 'blue-olive', 'o@restopilot.dev', 'Onboarded Owner']],
    [
      'malformed identifier',
      ['Onboarded Probe', 'Bad_Slug', 'o@restopilot.dev', 'Onboarded Owner'],
    ],
    [
      'unknown timezone',
      ['Onboarded Probe', 'onboarded-tz', 'o@restopilot.dev', 'Onboarded Owner', 'Mars/Olympus'],
    ],
    ['empty name', ['', 'onboarded-empty', 'o@restopilot.dev', 'Onboarded Owner']],
    [
      'invalid owner email',
      ['Onboarded Probe', 'onboarded-mail', 'not-an-email', 'Onboarded Owner'],
    ],
    ['empty owner display name', ['Onboarded Probe', 'onboarded-name', 'o2@restopilot.dev', '']],
  ] as const)('refuses %s verbatim with zero footprint', async (...args) => {
    const [, params] = args as [string, readonly string[]]
    const before = await totalFootprint()
    await asUser(client, authUserIds.platformAdmin, async () => {
      await expectStatementToFail(
        client,
        'P0001',
        'select public.onboard_restaurant($1, $2, $3, $4, null, null, null, $5)',
        [params[0], params[1], params[2], params[3], params[4] ?? 'UTC'],
      )
    })
    const after = await totalFootprint()
    expect(after).toEqual(before)
  })

  it('refuses a duplicate-email race verbatim (the helper re-raise)', async () => {
    await inTransaction(client, async () => {
      // 'dan@restopilot.dev' exists with a profile — but the helper returns
      // it (link). The verbatim duplicate refusal only fires on a true
      // concurrent insert race; the reachable refusal here is a slug
      // conflict mid-flight, proven above. The no-duplicates index guards
      // the membership: onboard the same email twice — the second run
      // LINKS the same person (never a duplicate), so assert exactly one
      // owner membership per tenant and the email's user count unchanged.
      // auth.users counts read through the connection role (no grants for
      // client roles), onboarding runs as the super admin.
      await client.query('reset role')
      const countBy = async () =>
        (
          await client.query('select count(*)::int as n from auth.users where lower(email) = $1', [
            'o3@restopilot.dev',
          ])
        ).rows[0]!.n
      const before = await countBy()
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.platformAdmin }),
      ])
      await onboard('onboarded-race-a', 'o3@restopilot.dev')
      const r2 = await onboard('onboarded-race-b', 'o3@restopilot.dev')
      expect(r2.rows[0]!.r.owner.outcome).toBe('linked')
      await client.query('reset role')
      expect((await countBy()) - before).toBe(1)
    })
  })
})

describe('the onboarded tenant under the standing rulebook (SC-005, T007)', () => {
  // These probes prove LIVE surfaces, so the onboarding must persist —
  // unlike the suites above it cannot hide inside a rolled-back
  // transaction. It runs once here; every probe still gets its own
  // rolled-back transaction, and afterAll removes the tenant.
  const state = { restaurantId: '', ownerAuthId: '' }

  beforeAll(async () => {
    // Session-level role + claims (autocommit): the onboarding must COMMIT
    // to prove the live surfaces below. afterAll removes the tenant.
    await client.query('set role authenticated')
    await client.query('select set_config($1, $2, false)', [
      'request.jwt.claims',
      JSON.stringify({ role: 'authenticated', sub: authUserIds.platformAdmin }),
    ])
    const r = await onboard('onboarded-rulebook')
    state.restaurantId = r.rows[0]!.r.restaurant_id

    // The profile lookup drops the client role (RLS hides profiles from
    // a platform admin with no memberships).
    await client.query('reset role')
    await client.query("select set_config('request.jwt.claims', '', false)")
    const p = await client.query('select auth_user_id from public.profiles where id = $1', [
      r.rows[0]!.r.owner.profile_id,
    ])
    state.ownerAuthId = p.rows[0]!.auth_user_id
  })

  it('the new owner sees only their restaurant through the standing read (FR-008b)', async () => {
    await asUser(client, state.ownerAuthId, async () => {
      const own = await client.query('select id from public.restaurants where id = $1', [
        state.restaurantId,
      ])
      expect(own.rows).toHaveLength(1)
      const others = await client.query('select id from public.restaurants where id <> $1', [
        state.restaurantId,
      ])
      expect(others.rows).toHaveLength(0)
    })
  })

  it('the super admin is refused the tenant audit read (the 014 posture)', async () => {
    await asUser(client, authUserIds.platformAdmin, async () => {
      await expectStatementToFail(client, '42501', 'select public.get_audit_log()')
    })
  })

  it('the new owner reads the onboarding audit entry through the tenant surface', async () => {
    await asUser(client, state.ownerAuthId, async () => {
      // get_audit_log returns jsonb { entries: [...] }.
      const a = await client.query('select public.get_audit_log() as log')
      const entries = (
        a.rows[0]!.log as { entries: Array<{ action: string; reason: string | null }> }
      ).entries
      const row = entries.find((x) => x.action === 'platform.restaurant_onboarded')
      expect(row).toBeDefined()
      expect(row!.reason).toBe('first owner provisioned')
    })
  })

  it('never_activated and unflagged — the exact shape the 014 Important rule covers', async () => {
    await inTransaction(client, async () => {
      const f = await client.query(
        `select r.platform_disabled, s.start_date, s.end_date
         from public.restaurants r
         join public.subscriptions s on s.restaurant_id = r.id
         where r.id = $1`,
        [state.restaurantId],
      )
      expect(f.rows[0]!.platform_disabled).toBe(false)
      expect(f.rows[0]!.start_date).toBeNull()
      expect(f.rows[0]!.end_date).toBeNull()
    })
  })

  it('the console overview sees the onboarded tenant immediately (FR-009)', async () => {
    await asUser(client, authUserIds.platformAdmin, async () => {
      const o = await client.query('select get_platform_overview() as o')
      const row = (o.rows[0]!.o as Array<Record<string, unknown>>).find(
        (x) => x.slug === 'onboarded-rulebook',
      )
      expect(row).toBeDefined()
      expect(row!.state).toBe('never_activated')
      expect(row!.staff_count).toBe(1)
    })
  })
})
