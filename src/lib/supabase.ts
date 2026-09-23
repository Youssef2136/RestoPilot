import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { getClientEnv } from './env'

/**
 * Supabase client factory (research.md §7).
 *
 * Typed with the generated `Database` types (src/types/database.types.ts) and
 * authenticated with the publishable key. Configuration is validated through
 * `getClientEnv`, so missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * fails fast with a message naming the missing values (spec FR-016).
 */

export function createSupabaseClient(): SupabaseClient<Database> {
  const { supabaseUrl, supabasePublishableKey } = getClientEnv()
  return createClient<Database>(supabaseUrl, supabasePublishableKey)
}

let cachedClient: SupabaseClient<Database> | undefined

/** Memoized client for application code (`getSupabaseClient()`). */
export function getSupabaseClient(): SupabaseClient<Database> {
  cachedClient ??= createSupabaseClient()
  return cachedClient
}

/**
 * A client whose session persistence lives only in memory (spec 020, research
 * R2): used by the change-password flow's verification attempt so the
 * throwaway sign-in never writes the shared localStorage token slot —
 * writing it would inject a second session into the app's persisted state
 * and could leave dead tokens behind after the credential change.
 */
export function createEphemeralSupabaseClient(): SupabaseClient<Database> {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
  const { supabaseUrl, supabasePublishableKey } = getClientEnv()
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { storage: memoryStorage },
  })
}
