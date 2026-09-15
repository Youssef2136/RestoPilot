/**
 * Typed environment reader with fail-fast validation (spec FR-016).
 *
 * Two validation scopes:
 * - Client env (public `VITE_` values): required by the running application.
 * - Full env (all four values): required by tooling that also touches the
 *   database directly (scripts, database tests).
 *
 * Missing values always throw a {@link MissingEnvironmentError} that names
 * every missing variable and where to configure them — the system never
 * continues silently misconfigured.
 */

export interface ClientEnv {
  supabaseUrl: string
  supabaseAnonKey: string
}

export interface FullEnv extends ClientEnv {
  supabaseDbUrl: string
  supabaseProjectRef: string
}

const CLIENT_VARIABLES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const
const SECRET_VARIABLES = ['SUPABASE_DB_URL', 'SUPABASE_PROJECT_REF'] as const

export class MissingEnvironmentError extends Error {
  readonly missingVariables: string[]

  constructor(missingVariables: string[]) {
    super(
      `Missing required environment variable(s): ${missingVariables.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values — ' +
        'see docs/development.md (Setup) for where to find each one.',
    )
    this.name = 'MissingEnvironmentError'
    this.missingVariables = missingVariables
  }
}

type EnvSource = Record<string, string | undefined>

function requireVariables(source: EnvSource, variables: readonly string[]): Record<string, string> {
  const missing = variables.filter((name) => !source[name])
  if (missing.length > 0) {
    throw new MissingEnvironmentError(missing)
  }
  return Object.fromEntries(variables.map((name) => [name, source[name] as string]))
}

/** Validates and returns the public client values the app needs to run. */
export function getClientEnv(source: EnvSource = import.meta.env): ClientEnv {
  const env = requireVariables(source, CLIENT_VARIABLES)
  return {
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
  }
}

/** Validates and returns the complete environment contract (all four values). */
export function getFullEnv(source: EnvSource = import.meta.env): FullEnv {
  const client = requireVariables(source, CLIENT_VARIABLES)
  const secrets = requireVariables(source, SECRET_VARIABLES)
  return {
    supabaseUrl: client.VITE_SUPABASE_URL,
    supabaseAnonKey: client.VITE_SUPABASE_ANON_KEY,
    supabaseDbUrl: secrets.SUPABASE_DB_URL,
    supabaseProjectRef: secrets.SUPABASE_PROJECT_REF,
  }
}
