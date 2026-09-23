import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  authClient,
  CURRENT_PASSWORD_FAILURE_MESSAGE,
  PASSWORD_RESET_FAILURE_MESSAGE,
} from '../../src/features/auth/authClient'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Unit proofs for the change-password flow's client contract (spec 020,
 * contracts/auth-client.md; research R2/R3): verify-before-update ordering,
 * the distinct-vs-generic message policy, self-targeting by construction,
 * and credential hygiene (no password material reaches any sink).
 *
 * Mock discipline (matches tests/unit/auth.guards.test.tsx): the module's
 * seams are mocked, never the unit under test — here the two supabase client
 * factories, so `authClient.changePassword` runs its real logic against
 * scripted auth responses.
 */

type AuthChain = {
  signInWithPassword: ReturnType<typeof vi.fn>
  getUser: ReturnType<typeof vi.fn>
  updateUser: ReturnType<typeof vi.fn>
}

function makeClient(overrides: Partial<AuthChain> = {}): SupabaseClient & { auth: AuthChain } {
  const auth: AuthChain = {
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: 'u1', email: 'x@y.z' } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    ...overrides,
  }
  return { auth } as unknown as SupabaseClient & { auth: AuthChain }
}

const harness = vi.hoisted(() => ({
  ephemeral: undefined as ReturnType<typeof makeClient> | undefined,
  shared: undefined as ReturnType<typeof makeClient> | undefined,
  calls: [] as string[],
}))

vi.mock('../../src/lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/supabase')>()
  return {
    ...actual,
    createEphemeralSupabaseClient: () => {
      harness.calls.push('createEphemeral')
      return harness.ephemeral
    },
    getSupabaseClient: () => {
      harness.calls.push('getShared')
      return harness.shared
    },
  }
})

/** The scripted auth surface of a client, recorded call-by-call. */
function scripted(ephemeral: ReturnType<typeof makeClient>, shared: ReturnType<typeof makeClient>) {
  harness.ephemeral = ephemeral
  harness.shared = shared
  harness.calls = []
}

beforeEach(() => {
  scripted(makeClient(), makeClient())
})

describe('execution order: verify strictly before apply (contract step 1 → 2)', () => {
  it('runs the sign-in attempt on the ephemeral client first, then the update on the shared one', async () => {
    const result = await authClient.changePassword({ currentPassword: 'old', newPassword: 'new' })
    expect(result).toEqual({ ok: true })
    expect(harness.calls).toEqual(['createEphemeral', 'getShared', 'getShared'])
    expect(harness.ephemeral!.auth.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(harness.shared!.auth.updateUser).toHaveBeenCalledTimes(1)
  })

  it('never calls updateUser when verification fails', async () => {
    scripted(
      makeClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: 'Invalid login credentials' },
        }),
      }),
      makeClient(),
    )
    const result = await authClient.changePassword({ currentPassword: 'wrong', newPassword: 'new' })
    expect(result).toEqual({ ok: false, message: CURRENT_PASSWORD_FAILURE_MESSAGE })
    expect(harness.shared!.auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('message policy (FR-006, clarify 2026-09-23): exactly one distinct cause', () => {
  it('verification failure yields the distinct current-password message', async () => {
    scripted(
      makeClient({
        signInWithPassword: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: { message: 'x' } }),
      }),
      makeClient(),
    )
    const result = await authClient.changePassword({ currentPassword: 'wrong', newPassword: 'new' })
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ message: CURRENT_PASSWORD_FAILURE_MESSAGE })
  })

  it('update failure — regardless of cause — yields the one generic message', async () => {
    for (const platformMessage of [
      'Password should be at least 6 characters.',
      'Auth session missing!',
    ]) {
      scripted(
        makeClient(),
        makeClient({
          updateUser: vi
            .fn()
            .mockResolvedValue({ data: { user: null }, error: { message: platformMessage } }),
        }),
      )
      const result = await authClient.changePassword({ currentPassword: 'old', newPassword: 'new' })
      expect(result).toEqual({ ok: false, message: PASSWORD_RESET_FAILURE_MESSAGE })
    }
  })

  it('neither message ever echoes platform error bodies or password material', async () => {
    scripted(
      makeClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: 'secret-platform-detail' },
        }),
      }),
      makeClient(),
    )
    const result = await authClient.changePassword({
      currentPassword: 'hunter2',
      newPassword: 'hunter3',
    })
    if (!result.ok) {
      expect(result.message).not.toContain('secret-platform-detail')
      expect(result.message).not.toContain('hunter2')
      expect(result.message).not.toContain('hunter3')
    }
    scripted(
      makeClient(),
      makeClient({
        updateUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: { message: 'weak-password details' } }),
      }),
    )
    const result2 = await authClient.changePassword({
      currentPassword: 'hunter2',
      newPassword: 'hunter3',
    })
    if (!result2.ok) {
      expect(result2.message).not.toContain('weak-password')
    }
  })
})

describe('self-targeting by construction (FR-003): no account selector anywhere', () => {
  it('derives the verification email from the live session subject and passes only the credential fields', async () => {
    const result = await authClient.changePassword({ currentPassword: 'old', newPassword: 'new' })
    expect(result).toEqual({ ok: true })
    const verifyArgs = harness.ephemeral!.auth.signInWithPassword.mock.calls[0][0] as {
      email: string
      password: string
    }
    expect(Object.keys(verifyArgs).sort()).toEqual(['email', 'password'])
    expect(verifyArgs.email).toBe('x@y.z')
    const updateArgs = harness.shared!.auth.updateUser.mock.calls[0][0] as { password: string }
    expect(Object.keys(updateArgs).sort()).toEqual(['password'])
  })
})

describe('credential hygiene (FR-010): no password material reaches any sink', () => {
  let logSpy: MockInstance
  let warnSpy: MockInstance
  let errorSpy: MockInstance

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log')
    warnSpy = vi.spyOn(console, 'warn')
    errorSpy = vi.spyOn(console, 'error')
  })

  it('the success path logs nothing containing the passwords', async () => {
    await authClient.changePassword({ currentPassword: 'hunter2', newPassword: 'hunter3' })
    for (const spy of [logSpy, warnSpy, errorSpy]) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('hunter2')
        expect(JSON.stringify(call)).not.toContain('hunter3')
      }
    }
  })

  it('the failure paths log nothing containing the passwords', async () => {
    scripted(
      makeClient({
        signInWithPassword: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: { message: 'no' } }),
      }),
      makeClient(),
    )
    await authClient.changePassword({ currentPassword: 'hunter2', newPassword: 'hunter3' })
    scripted(
      makeClient(),
      makeClient({
        updateUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'no' } }),
      }),
    )
    await authClient.changePassword({ currentPassword: 'hunter2', newPassword: 'hunter3' })
    for (const spy of [logSpy, warnSpy, errorSpy]) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('hunter2')
        expect(JSON.stringify(call)).not.toContain('hunter3')
      }
    }
  })
})
