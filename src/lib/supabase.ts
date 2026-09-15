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
