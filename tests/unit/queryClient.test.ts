import { describe, expect, it } from 'vitest'
import { createQueryClient, queryClient } from '../../src/app/queryClient'

/**
 * The QueryClient policy pin (spec 021 FR-05 / US3, SC-004): the centralized
 * client's defaults must equal the documented policy in research.md R2 —
 * which codifies the pre-phase observable behavior exactly. Any change here
 * is a behavior change to staff/customer data freshness and must go through
 * the spec's deviation process, never a silent default change.
 */
describe('queryClient policy (spec 021 FR-05, SC-004)', () => {
  it('pins the centralized defaults to the documented policy', () => {
    const client = createQueryClient()
    const defaults = client.getDefaultOptions()

    expect(defaults.queries?.retry).toBe(3)
    expect(defaults.queries?.staleTime).toBe(0)
    expect(defaults.queries?.gcTime).toBe(5 * 60 * 1000)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true)
    expect(defaults.queries?.refetchOnReconnect).toBe(true)
  })

  it('pins mutations to never auto-resubmit (RPC-only writes surface refusals verbatim)', () => {
    const client = createQueryClient()
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })

  it('exposes the app singleton through the same policy', () => {
    expect(queryClient.getDefaultOptions()).toEqual(createQueryClient().getDefaultOptions())
  })
})
