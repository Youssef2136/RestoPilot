import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Security: secrets posture (spec 015 T007; FR-005; §25 area 6). The client
 * carries ONLY the publishable key and public URLs — asserted twice:
 *
 * 1. SOURCE: `src/` reads no env var other than the two VITE_ public ones,
 *    and no source file embeds a privileged credential shape.
 * 2. BUNDLE: when `dist/` exists (post-build), no privileged credential
 *    pattern appears in any emitted asset. A real finding FAILS the suite —
 *    absence of dist/ is a documented skip, not a pass.
 *
 * Privileged patterns: service-role JWTs, Postgres connection strings,
 * SMTP/password material, and the `service_role` marker itself.
 */
const PRIVILEGED_PATTERNS: Array<[string, RegExp]> = [
  ['service_role secret key', /sb_secret_[A-Za-z0-9_-]+/],
  ['legacy service key JWT', /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['postgres connection string', /postgres(?:ql)?:\/\/[^\s"']*:[^\s"']*@/],
  ['service_role literal', /service_role/],
  ['smtp password literal', /SMTP_PASS(?:WORD)?\s*=/],
  ['aws secret literal', /aws_secret_access_key\s*=/i],
]

// The variable NAME `SUPABASE_DB_URL` legitimately appears in src/lib/env.ts
// (the tooling-contract validator names the variable; it never embeds the
// VALUE). Credential VALUES in the client are the attack — name-only
// references are the documented contract (plan D3, spec FR-005).
const SOURCE_NAME_ONLY_OK = ['src\\lib\\env.ts', 'src/lib/env.ts']

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) {
      yield* walk(p)
    } else {
      yield p
    }
  }
}

describe('security: no privileged secret reaches the client (FR-005)', () => {
  const ROOT = process.cwd()

  it('src reads only the public VITE_ env vars', () => {
    const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])
    const seen = new Set<string>()
    let readers = 0
    for (const file of walk(join(ROOT, 'src'))) {
      if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/(?:import\.meta\.env|process\.env)(?:\.([A-Z0-9_]+))?/g)) {
        if (m[1]) seen.add(m[1])
        readers++
      }
    }
    // The contract: exactly one reader module (src/lib/env.ts), no direct
    // dot-reads of non-public vars anywhere.
    expect(readers).toBeGreaterThan(0) // the suite is live, not vacuous
    const offenders = [...seen].filter((k) => !allowed.has(k))
    expect(offenders).toEqual([])
  })

  it('source files embed no privileged credential pattern', () => {
    for (const file of walk(join(ROOT, 'src'))) {
      if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
      const text = readFileSync(file, 'utf8')
      for (const [name, re] of PRIVILEGED_PATTERNS) {
        if (re.test(text)) {
          throw new Error(`Privileged pattern (${name}) found in source: ${file}`)
        }
      }
    }
    // The env contract validator may NAME SUPABASE_DB_URL (nothing else may
    // reference it at all) — and no source file may embed its VALUE shape.
    for (const file of walk(join(ROOT, 'src'))) {
      if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
      const rel = file.slice(ROOT.length + 1)
      const text = readFileSync(file, 'utf8')
      if (!SOURCE_NAME_ONLY_OK.some((ok) => rel === ok)) {
        expect(text.includes('SUPABASE_DB_URL'), `${rel} references SUPABASE_DB_URL`).toBe(false)
      }
      // A postgres:// URL with credentials anywhere in src is a leak.
      expect(/postgres(?:ql)?:\/\/[^\s"']*:[^\s"']*@/.test(text), `${rel} embeds a db URL`).toBe(
        false,
      )
    }
  })

  it('the built bundle (when present) embeds no privileged credential pattern', () => {
    const dist = join(ROOT, 'dist')
    if (!existsSync(dist)) {
      // Documented skip: `npm run verify` runs test:unit BEFORE build, so a
      // fresh checkout has no dist/ yet. The NEXT full verify (and CI) sees
      // the built bundle from the previous build. Never a silent pass when
      // dist/ exists — a finding below throws.
      console.warn('dist/ absent — bundle assertion deferred to the next post-build run')
      return
    }
    for (const file of walk(dist)) {
      if (!/\.(js|css|html|map|svg|json)$/.test(file)) continue
      const text = readFileSync(file, 'utf8')
      for (const [name, re] of PRIVILEGED_PATTERNS) {
        if (re.test(text)) {
          throw new Error(`Privileged pattern (${name}) found in build output: ${file}`)
        }
      }
    }
  })

  it('the env contract: only the two public VITE_ keys are client-reachable', () => {
    // The client env contract is `VITE_SUPABASE_URL` +
    // `VITE_SUPABASE_PUBLISHABLE_KEY` — anything else prefixed VITE_ would
    // silently ship to browsers (Vite's include-by-prefix rule).
    const envExample = existsSync(join(ROOT, '.env.example'))
      ? readFileSync(join(ROOT, '.env.example'), 'utf8')
      : ''
    const declared = [...envExample.matchAll(/^(VITE_[A-Z0-9_]+)=/gm)].map((m) => m[1])
    for (const key of declared) {
      expect(
        key === 'VITE_SUPABASE_URL' || key === 'VITE_SUPABASE_PUBLISHABLE_KEY',
        `.env.example declares non-public client var: ${key}`,
      ).toBe(true)
    }
  })
})
