import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types'
import { createDbClient } from '../database/helpers/db'
import {
  branchIds,
  diningTableIds,
  restaurantIds,
  seedCredentials,
} from '../database/helpers/fixtures'

/**
 * Integration suite — User Story 4 exit condition: the provisioning round trip
 * over the REAL APIs (spec 004 US4; FR-013, FR-014, FR-017; SC-004 — the
 * story's Independent Test, run for real).
 *
 * The owner provisions a person through `add_staff_member` on the real data
 * API; the returned one-time credential then signs in through the real Auth
 * API; `current_auth_context` resolves EXACTLY the assigned scope; and the
 * out-of-scope reads a cashier must not reach are denied through the real
 * client under its own grants and RLS policies.
 *
 * Residue: the shared cloud development database is the fixture. `afterAll`
 * removes everything this suite created — the membership, the profile, the
 * auth identity (and its user row), and the suite's own audit records —
 * through the owner connection, and asserts nothing remains. The scratch
 * email is deterministic, so a failed teardown is visible on the next run
 * rather than accumulating.
 *
 * Rate-limit aware (research.md §12; quickstart.md §2): this suite adds ONE
 * Auth sign-in per run on top of the existing integration suite. Leave at
 * least 60 seconds between consecutive `test:integration` runs so the two
 * suites' sign-ins stay under the documented 30-per-5-minutes budget.
 *
 * Preconditions: migrated + seeded cloud development database
 * (`npm run db:migrate && npm run db:seed`).
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Copy .env.example to .env and fill it in — see docs/development.md (Setup).',
    )
  }
  return value
}

function createAuthClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
  )
}

/** The deterministic scratch person this suite provisions and removes. */
const SCRATCH = {
  email: 'scratch-provisioned@restopilot.dev',
  displayName: 'Provisioned Person',
} as const

const ownerDb = createDbClient()

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

/** The caller's effective context as the guards consume it. */
async function authContext(client: SupabaseClient<Database>) {
  const { data, error } = await client.rpc('current_auth_context')
  expect(error).toBeNull()
  return typeof data === 'string' ? JSON.parse(data) : data
}

let ownerClient: SupabaseClient<Database>
let provisioned: AddedStaffMember
/** Set once the credential has been used, so teardown always runs against a known id. */
let scratchAuthUserId: string | null = null

beforeAll(async () => {
  await ownerDb.connect()

  // The owner signs in through the real Auth API (the seeded fixture).
  ownerClient = createAuthClient()
  const { error } = await ownerClient.auth.signInWithPassword({
    email: seedCredentials.alice.email,
    password: seedCredentials.alice.password,
  })
  expect(error).toBeNull()
})

afterAll(async () => {
  // Teardown through the owner connection, in FK order. Everything is removed:
  // this suite leaves the shared database exactly as it found it.
  if (provisioned !== undefined) {
    const membershipId = provisioned.membership.id
    const profileId = provisioned.profile_id

    await ownerDb.query(`delete from public.audit_log where resource_id = $1`, [membershipId])
    await ownerDb.query(`delete from public.staff_memberships where id = $1`, [membershipId])
    await ownerDb.query(`delete from public.profiles where id = $1`, [profileId])
    if (scratchAuthUserId !== null) {
      await ownerDb.query(`delete from auth.identities where user_id = $1`, [scratchAuthUserId])
      await ownerDb.query(`delete from auth.users where id = $1`, [scratchAuthUserId])
    }

    // No residue: neither the person nor the membership survives. The casts
    // are explicit because `audit_log.resource_id` is text while the id
    // columns are uuid — one parameter, two target types.
    const residue = await ownerDb.query(
      `select
         (select count(*)::int from public.staff_memberships where id = $1::uuid) as memberships,
         (select count(*)::int from public.profiles where id = $2::uuid) as profiles,
         (select count(*)::int from public.audit_log where resource_id = $1::text) as audit,
         (select count(*)::int from auth.users where email = $3::text) as identities`,
      [membershipId, profileId, SCRATCH.email],
    )
    expect(residue.rows[0]).toEqual({ memberships: 0, profiles: 0, audit: 0, identities: 0 })
  }

  await ownerDb.end()
})

describe('provisioning round trip (FR-013/FR-014/FR-017, SC-004)', () => {
  it(
    'the owner provisions a person through the data API and the returned one-time credential signs in',
    { timeout: 60_000 },
    async () => {
      // The owner alone may add staff (FR-006/FR-013) — and does, for real.
      const { data, error } = await ownerClient.rpc('add_staff_member', {
        p_restaurant_id: restaurantIds.blueOlive,
        p_email: SCRATCH.email,
        p_display_name: SCRATCH.displayName,
        p_role: 'cashier',
        p_branch_id: branchIds.marina,
      })
      expect(error).toBeNull()

      provisioned = (typeof data === 'string' ? JSON.parse(data) : data) as AddedStaffMember
      expect(provisioned.person_created).toBe(true)
      expect(provisioned.membership).toMatchObject({
        restaurant_id: restaurantIds.blueOlive,
        role: 'cashier',
        branch_id: branchIds.marina,
      })
      const temporaryPassword = provisioned.temporary_password
      expect(temporaryPassword).toMatch(/^[0-9a-f]{24}$/)

      // The one-time credential works against the real Auth API — the whole
      // point of the provisioning contract (FR-013/FR-014).
      const staffClient = createAuthClient()
      const signIn = await staffClient.auth.signInWithPassword({
        email: SCRATCH.email,
        password: temporaryPassword as string,
      })
      expect(signIn.error).toBeNull()
      scratchAuthUserId = signIn.data.user?.id ?? null
      expect(scratchAuthUserId).not.toBeNull()

      // The session is the provisioned person: the seeded FK links their
      // profile to this identity.
      const { data: context } = await staffClient.rpc('current_auth_context')
      const parsed = typeof context === 'string' ? JSON.parse(context) : context
      expect(parsed.profile).toMatchObject({
        id: provisioned.profile_id,
        display_name: SCRATCH.displayName,
      })
    },
  )

  it(
    'the provisioned person resolves exactly the assigned scope, and out-of-scope reads are denied',
    { timeout: 60_000 },
    async () => {
      const staffClient = createAuthClient()
      const signIn = await staffClient.auth.signInWithPassword({
        email: SCRATCH.email,
        password: provisioned.temporary_password as string,
      })
      expect(signIn.error).toBeNull()

      // Exactly the assigned scope — one membership, cashier at Marina
      // (FR-017, SC-004). The projection carries the names the caller may
      // already read, never anything else.
      const context = await authContext(staffClient)
      expect(context.memberships).toEqual([
        {
          restaurant_id: restaurantIds.blueOlive,
          restaurant_slug: 'blue-olive',
          restaurant_name: 'Blue Olive',
          role: 'cashier',
          branch_id: branchIds.marina,
          branch_name: 'Marina',
        },
      ])

      // Policy-scoped reads: the assigned branch's tables only — Downtown's
      // and the other tenant's tables are not reachable (FR-025).
      const { data: tables, error: tablesError } = await staffClient
        .from('dining_tables')
        .select('id')
      expect(tablesError).toBeNull()
      expect(new Set((tables ?? []).map((row) => row.id))).toEqual(
        new Set([diningTableIds.marinaT1]),
      )

      // The other tenant's restaurant is not readable at all.
      const { data: cedar } = await staffClient
        .from('restaurants')
        .select('id')
        .eq('id', restaurantIds.cedarGrill)
      expect(cedar).toEqual([])

      // A cashier manages nothing: the management RPCs are owner-only, and the
      // denial comes from the database — not from the UI (Constitution IV).
      const { error: managementError } = await staffClient.rpc('create_branch', {
        p_restaurant_id: restaurantIds.blueOlive,
        p_name: 'Not Allowed',
      })
      expect(managementError).not.toBeNull()
      expect(managementError?.code).toBe('42501')

      // The owner, by contrast, reads both of the restaurant's branches.
      const { data: ownerBranches } = await ownerClient.from('branches').select('id')
      expect(new Set((ownerBranches ?? []).map((row) => row.id))).toEqual(
        new Set([branchIds.downtown, branchIds.marina]),
      )

      await staffClient.auth.signOut()
    },
  )
})
