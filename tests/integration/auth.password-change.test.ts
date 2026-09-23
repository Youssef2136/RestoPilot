import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthApiError, createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types'
import { createDbClient } from '../database/helpers/db'
import {
  authClient,
  CURRENT_PASSWORD_FAILURE_MESSAGE,
  PASSWORD_RESET_FAILURE_MESSAGE,
} from '../../src/features/auth/authClient'
import { getSupabaseClient } from '../../src/lib/supabase'
import { branchIds, restaurantIds } from '../database/helpers/fixtures'

/**
 * Integration suite — the self-service password change's session matrix and
 * authorization-drift proof (spec 020 US2; FR-004/006/007/008/013; SC-002/
 * SC-003), run against the REAL platform auth API.
 *
 * Identity discipline: a dedicated SCRATCH identity is provisioned here with
 * the verified seeded-identity SQL pattern (contracts/supabase-auth-surface.md
 * — the documented exception under which suites may create scratch
 * identities) and deleted afterwards. No fixture account's password is ever
 * touched (the fixtures' documented `purge-auth` reset remains a safety net).
 *
 * Platform semantics under proof (all verified during specification — this
 * suite pins them so regressions surface): the initiating session stays
 * valid; every independently established session is invalidated; the old
 * password dies immediately; profile/memberships/scope are byte-identical
 * around the change; the same-profile tab shares the surviving session (the
 * clarify-corrected semantics — a tab adopting the refreshed shared tokens
 * keeps working).
 *
 * Rate-limit aware: ~6 sign-in attempts per run — well under the documented
 * 30-per-5-minutes budget.
 *
 * Preconditions: migrated + seeded cloud development database.
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

const SCRATCH_ID = '00000000-0000-4000-8000-00000000b001'
const SCRATCH_EMAIL = 'scratch-password-change@restopilot.dev'
const SCRATCH_PASSWORD = 'dev-scratch-pwchange-2026'
const SCRATCH_NEW_PASSWORD = 'dev-scratch-pwchange-new-2026'
const SCRATCH_PROFILE_ID = '00000000-0000-4000-8000-00000000b101'
const SCRATCH_MEMBERSHIP_ID = '00000000-0000-4000-8000-00000000b201'

const db = createDbClient()

beforeAll(async () => {
  await db.connect()
  // Defensive cleanup (an interrupted earlier run may have left the scratch
  // rows): membership → profile → auth user (the profile's FK has no cascade).
  await db.query('delete from public.staff_memberships where id = $1', [SCRATCH_MEMBERSHIP_ID])
  await db.query('delete from public.profiles where id = $1', [SCRATCH_PROFILE_ID])
  await db.query('delete from auth.users where id = $1', [SCRATCH_ID])
  await db.query(
    `insert into auth.users (
       id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
       confirmation_token, recovery_token, email_change,
       email_change_token_new, email_change_token_current, created_at, updated_at
     ) values (
       $1, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf', 10)),
       now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       '', '', '', '', '', now(), now()
     )
     on conflict (id) do nothing`,
    [SCRATCH_ID, SCRATCH_EMAIL, SCRATCH_PASSWORD],
  )
  await db.query(
    `insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at)
     values (
       $1::uuid, $1::uuid, 'email', $1::uuid,
       jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
       now(), now()
     )
     on conflict (id) do nothing`,
    [SCRATCH_ID, SCRATCH_EMAIL],
  )
  // The linked account state: profile + cashier membership — exactly the
  // authorization state the change must NOT alter (FR-008/SC-003).
  await db.query(
    `insert into public.profiles (id, display_name, auth_user_id, is_super_admin)
     values ($1, 'Scratch Password Change', $2, false)
     on conflict (id) do nothing`,
    [SCRATCH_PROFILE_ID, SCRATCH_ID],
  )
  await db.query(
    `insert into public.staff_memberships (id, profile_id, restaurant_id, role, branch_id)
     values ($1, $2, $3, 'cashier', $4)
     on conflict (id) do nothing`,
    [SCRATCH_MEMBERSHIP_ID, SCRATCH_PROFILE_ID, restaurantIds.blueOlive, branchIds.downtown],
  )
}, 20_000)

afterAll(async () => {
  await db.query('delete from public.staff_memberships where id = $1', [SCRATCH_MEMBERSHIP_ID])
  await db.query('delete from public.profiles where id = $1', [SCRATCH_PROFILE_ID])
  await db.query('delete from auth.users where id = $1', [SCRATCH_ID])
  await db.end()
})

/** The caller's effective context through the real RPC. */
async function readAuthContext(client: SupabaseClient<Database>) {
  const { data, error } = await client.rpc('current_auth_context')
  expect(error).toBeNull()
  return typeof data === 'string' ? JSON.parse(data) : data
}

/** The full readable scope through the real data API (SC-003 drift check). */
async function readableScope(client: SupabaseClient<Database>) {
  const scope: Record<string, string[]> = {}
  for (const table of ['restaurants', 'branches', 'dining_tables', 'staff_memberships'] as const) {
    const { data, error } = await client.from(table).select('id')
    expect(error).toBeNull()
    scope[table] = (data ?? []).map((row) => row.id).sort()
  }
  return scope
}

describe('the self-service change on a live session (FR-004/FR-006/FR-007/FR-013)', () => {
  it(
    'verifies the current password, applies the change, and leaves the initiating session alive',
    { timeout: 30_000 },
    async () => {
      // The initiating session — the SHARED client, exactly as in the app:
      // the page's session lives on the app-level client, and
      // `changePassword` reads the account email from that session's subject
      // (self-targeting by construction) and applies the update on it.
      const initiator = getSupabaseClient()
      const signIn = await initiator.auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_PASSWORD,
      })
      expect(signIn.error).toBeNull()

      // An independently established session — a separate sign-in record.
      const otherDevice = createAuthClient()
      const otherSignIn = await otherDevice.auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_PASSWORD,
      })
      expect(otherSignIn.error).toBeNull()

      // Authorization snapshot BEFORE (SC-003).
      const contextBefore = await readAuthContext(initiator)
      expect(contextBefore.profile).toEqual({
        id: SCRATCH_PROFILE_ID,
        display_name: 'Scratch Password Change',
        is_super_admin: false,
      })
      expect(contextBefore.memberships).toEqual([
        {
          restaurant_id: restaurantIds.blueOlive,
          restaurant_slug: 'blue-olive',
          restaurant_name: 'Blue Olive',
          role: 'cashier',
          branch_id: branchIds.downtown,
          branch_name: 'Downtown',
        },
      ])
      const scopeBefore = await readableScope(initiator)

      // A WRONG current password is refused with the distinct message and
      // changes nothing (FR-004/FR-006).
      const wrongAttempt = await authClient.changePassword({
        currentPassword: 'definitely-wrong',
        newPassword: SCRATCH_NEW_PASSWORD,
      })
      expect(wrongAttempt).toEqual({ ok: false, message: CURRENT_PASSWORD_FAILURE_MESSAGE })
      // The credential is untouched: the original password still signs in.
      const untouched = await createAuthClient().auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_PASSWORD,
      })
      expect(untouched.error).toBeNull()
      // (No explicit sign-out needed — this probe session is invalidated by
      // the change below, like every other independent session.)

      // The real change through the client contract.
      const result = await authClient.changePassword({
        currentPassword: SCRATCH_PASSWORD,
        newPassword: SCRATCH_NEW_PASSWORD,
      })
      expect(result).toEqual({ ok: true })

      // (a) The initiating session remains valid (FR-007).
      const { error: initiatorError } = await initiator.auth.getUser()
      expect(initiatorError).toBeNull()

      // (b) The independently established session is invalidated (FR-007,
      // SC-002): its next authenticated action is denied.
      const { error: otherError } = await otherDevice.auth.getUser()
      expect(otherError).not.toBeNull()

      // (c) Fresh sign-ins: old dead, new works (FR-013).
      const oldSignIn = await createAuthClient().auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_PASSWORD,
      })
      expect(oldSignIn.data.session).toBeNull()
      expect(oldSignIn.error).toBeInstanceOf(AuthApiError)
      expect((oldSignIn.error as AuthApiError).code).toBe('invalid_credentials')

      const newSignIn = createAuthClient()
      const newSession = await newSignIn.auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_NEW_PASSWORD,
      })
      expect(newSession.error).toBeNull()

      // (d) Zero authorization drift (FR-008, SC-003): profile, memberships,
      // and readable scope are identical around the change.
      const contextAfter = await readAuthContext(newSignIn)
      expect(contextAfter).toEqual(contextBefore)
      expect(await readableScope(newSignIn)).toEqual(scopeBefore)

      // (e) The same-profile tab shares the surviving session record (the
      // clarify-corrected semantics): a tab adopting the shared refreshed
      // tokens keeps working — the invalidation is per independent sign-in,
      // never per tab.
      const sharedTab = createAuthClient()
      const { data: initiatorSession } = await initiator.auth.getSession()
      expect(initiatorSession.session).not.toBeNull()
      const adopt = await sharedTab.auth.setSession({
        access_token: initiatorSession.session!.access_token,
        refresh_token: initiatorSession.session!.refresh_token,
      })
      expect(adopt.error).toBeNull()
      const { error: tabError } = await sharedTab.auth.getUser()
      expect(tabError).toBeNull()
    },
  )

  it(
    'surfaces the generic message when the platform rejects the update (policy failure shape)',
    { timeout: 30_000 },
    async () => {
      // The shared client again — the initiating session for the
      // policy-failure probe (the scratch identity now holds
      // SCRATCH_NEW_PASSWORD after the first test's change).
      const initiator = getSupabaseClient()
      const signIn = await initiator.auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_NEW_PASSWORD,
      })
      expect(signIn.error).toBeNull()

      const result = await authClient.changePassword({
        currentPassword: SCRATCH_NEW_PASSWORD,
        newPassword: 'x', // below the platform's minimum length — policy rejection
      })
      expect(result).toEqual({ ok: false, message: PASSWORD_RESET_FAILURE_MESSAGE })

      // The credential is untouched by the refused attempt.
      const still = await createAuthClient().auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_NEW_PASSWORD,
      })
      expect(still.error).toBeNull()
    },
  )
})
