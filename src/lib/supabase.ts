import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getClientEnv } from './env'

/**
 * Supabase client factory (research.md §7).
 *
 * Configuration is validated through `getClientEnv`, so a missing
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fails fast with a message naming
 * the missing values (spec FR-016) instead of producing a broken client.
 */

export function createSupabaseClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getClientEnv()
  return createClient(supabaseUrl, supabaseAnonKey)
}

let cachedClient: SupabaseClient | undefined

/** Memoized client for application code (`getSupabaseClient()`). */
export function getSupabaseClient(): SupabaseClient {
  cachedClient ??= createSupabaseClient()
  return cachedClient
}
