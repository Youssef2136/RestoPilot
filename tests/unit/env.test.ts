import { describe, expect, it } from 'vitest'
import { getClientEnv, getFullEnv, MissingEnvironmentError } from '../../src/lib/env'

const completeSource = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  SUPABASE_DB_URL: 'postgresql://user:pass@host:5432/postgres',
  SUPABASE_PROJECT_REF: 'ref-123',
}

describe('environment validation (spec FR-016)', () => {
  it('returns typed client values when the public variables are present', () => {
    const env = getClientEnv(completeSource)
    expect(env.supabaseUrl).toBe('https://example.supabase.co')
    expect(env.supabasePublishableKey).toBe('sb_publishable_example')
  })

  it('fails fast, naming every missing public variable', () => {
    let thrown: MissingEnvironmentError | undefined
    try {
      getClientEnv({})
    } catch (error) {
      thrown = error as MissingEnvironmentError
    }
    expect(thrown).toBeInstanceOf(MissingEnvironmentError)
    expect(thrown?.missingVariables).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])
    expect(thrown?.message).toMatch(/VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY/)
    expect(thrown?.message).toMatch(/\.env\.example/)
  })

  it('returns all four typed values from getFullEnv when the contract is complete', () => {
    const env = getFullEnv(completeSource)
    expect(env).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'sb_publishable_example',
      supabaseDbUrl: 'postgresql://user:pass@host:5432/postgres',
      supabaseProjectRef: 'ref-123',
    })
  })

  it('fails fast, naming a missing secret variable without losing the others', () => {
    let thrown: MissingEnvironmentError | undefined
    try {
      getFullEnv({ ...completeSource, SUPABASE_DB_URL: undefined })
    } catch (error) {
      thrown = error as MissingEnvironmentError
    }
    expect(thrown).toBeInstanceOf(MissingEnvironmentError)
    expect(thrown?.missingVariables).toEqual(['SUPABASE_DB_URL'])
  })
})
