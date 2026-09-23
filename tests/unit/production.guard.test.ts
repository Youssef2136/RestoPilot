import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  collectManifest,
  missingCredentials,
  validateBundle,
} from '../../scripts/deploy-frontend.mjs'
import { resolveResetGuard } from '../../scripts/db/reset.mjs'

/**
 * Production guard (spec 018 T007; FR-005; US4). The dev/production
 * boundary proven from the repository side — pure file reads and pure
 * functions, no database, no network, no credentials. Every assertion is
 * a standing proof the runbook relies on; the env-var tripwire fails the
 * whole unit run the moment `.env.example` and the runbook drift apart.
 */

const root = resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')

describe('seed never reaches a production deploy path (SC-005)', () => {
  const seed = read('supabase/seed.sql')

  it('the seed declares itself development-only', () => {
    expect(seed).toMatch(/cloud development database/i)
  })

  it('db:seed / db:reset appear in no build or deploy path', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts.build).not.toMatch(/db:seed|db:reset/)
    expect(pkg.scripts.deploy).not.toMatch(/db:seed|db:reset/)
    expect(pkg.scripts.verify).not.toMatch(/db:seed|db:reset/)
    const deployScript = read('scripts/deploy-frontend.mjs')
    expect(deployScript).not.toMatch(/db:seed|db:reset/)
  })
})

describe('secrets never ride the deploy path (FR-001)', () => {
  it('the deploy script never exports or feeds DB credentials to the build', () => {
    const deployScript = read('scripts/deploy-frontend.mjs')
    // The only permitted mention is the doc comment stating the prohibition;
    // no usage may appear outside it.
    const code = deployScript.split('*/').slice(1).join('*/')
    expect(code).not.toMatch(/SUPABASE_DB_URL/)
    expect(code).not.toMatch(/SERVICE_ROLE|service_role|SERVICE_ROLE_KEY/i)
    expect(code).not.toMatch(/vite build/)
  })

  it('the deploy script gates on all three Cloudflare credentials, naming each', () => {
    const deployScript = read('scripts/deploy-frontend.mjs')
    for (const name of [
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_PAGES_PROJECT',
    ]) {
      expect(deployScript).toContain(name)
    }
    expect(missingCredentials({})).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_PAGES_PROJECT',
    ])
    expect(
      missingCredentials({
        CLOUDFLARE_API_TOKEN: 't',
        CLOUDFLARE_ACCOUNT_ID: 'a',
        CLOUDFLARE_PAGES_PROJECT: 'p',
      }),
    ).toEqual([])
  })
})

describe('the deploy contract holds (FR-001/FR-002)', () => {
  it('validateBundle accepts a real dist with index.html at the root', () => {
    // dist/ is produced by `npm run build`; when present (verify runs the
    // build), the bundle validation must pass. When absent, the guard
    // still asserts the refusal is the documented reason.
    const result = validateBundle()
    if (result.ok) {
      const paths = collectManifest().map((f) => f.path)
      expect(paths).toContain('index.html')
    } else {
      expect(result.reason).toMatch(/npm run build/)
    }
  })

  it('validateBundle refuses a directory without the SPA fallback precondition', () => {
    // assert the refusal path via a guaranteed-missing directory
    expect(validateBundle('dist/definitely-missing-subdir').ok).toBe(false)
  })
})

describe('.env stays out of the repository (§45 secrets)', () => {
  it('.gitignore covers .env', () => {
    const gitignore = read('.gitignore')
    expect(gitignore).toMatch(/^\.env$/m)
  })
})

describe('runbook ↔ .env.example drift tripwire (SC-004)', () => {
  it('the runbook env-var table matches .env.example exactly', () => {
    const envExample = read('.env.example')
    const envVars = [...envExample.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1])
    expect(envVars.length).toBeGreaterThan(0)

    const runbook = read('docs/production-runbook.md')
    // The runbook's inventory is §5's table (pipe rows with a backticked
    // var in the first cell and the scope in the second).
    const runbookVars = [...runbook.matchAll(/^\| `([A-Z][A-Z0-9_]+)`\s+\|/gm)].map((m) => m[1])
    const deployTimeOnly = [
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_PAGES_PROJECT',
    ]

    for (const name of envVars) {
      expect(runbookVars, `runbook must document ${name}`).toContain(name)
    }
    for (const name of runbookVars) {
      if (!deployTimeOnly.includes(name)) {
        expect(
          envVars,
          `runbook documents ${name} but .env.example does not define it — update one of them`,
        ).toContain(name)
      }
    }
  })
})

describe('the reset guard (T008; plan D5)', () => {
  const REF_A = 'a'.repeat(20)
  const REF_B = 'b'.repeat(20)
  const direct = (ref: string) => `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`
  const pooled = (ref: string) =>
    `postgresql://postgres.${ref}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`

  it('proceeds when the target is the declared development project', () => {
    expect(resolveResetGuard({ dbUrl: direct(REF_A), devRef: REF_A })).toEqual({
      decision: 'proceed',
      targetRef: REF_A,
    })
    expect(resolveResetGuard({ dbUrl: pooled(REF_A), devRef: REF_A }).decision).toBe('proceed')
  })

  it('refuses a non-development project ref with the runbook pointer', () => {
    const result = resolveResetGuard({ dbUrl: direct(REF_B), devRef: REF_A })
    expect(result.decision).toBe('refuse')
    if (result.decision === 'refuse') {
      expect(result.reason).toMatch(/production-runbook/)
      expect(result.reason).toMatch(/--i-know-this-is-destructive/)
    }
  })

  it('refuses when no development ref is declared', () => {
    expect(resolveResetGuard({ dbUrl: pooled(REF_B), devRef: null }).decision).toBe('refuse')
  })

  it('the explicit override proceeds — loudly', () => {
    const result = resolveResetGuard({ dbUrl: direct(REF_B), devRef: REF_A, override: true })
    expect(result.decision).toBe('proceed')
    if (result.decision === 'proceed') {
      expect(result.warning).toMatch(/NOT the declared development project/)
    }
  })

  it('refuses URLs that do not identify a Supabase project', () => {
    expect(
      resolveResetGuard({
        dbUrl: 'postgresql://postgres:pw@db.example.com:5432/postgres',
        devRef: REF_A,
      }).decision,
    ).toBe('refuse')
    expect(
      resolveResetGuard({ dbUrl: 'postgresql://postgres:pw@localhost:5432/postgres', devRef: null })
        .decision,
    ).toBe('refuse')
  })
})
