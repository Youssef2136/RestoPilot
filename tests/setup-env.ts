/**
 * Loads .env (when present) so database tests can reach the configured
 * Supabase Cloud project. A missing or incomplete environment is reported
 * by the tests themselves with named-variable guidance (spec FR-016).
 */
try {
  process.loadEnvFile()
} catch {
  // No .env file present — configuration-dependent tests fail fast with
  // clear instructions instead of silently skipping.
}
