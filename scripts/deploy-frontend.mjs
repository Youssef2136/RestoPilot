#!/usr/bin/env node
/**
 * Deploy the production frontend build to Cloudflare Pages (spec 018 T001;
 * FR-001, FR-002; plan D1/D2).
 *
 * Modes:
 *   --dry-run   validate everything printable without any credential:
 *               build check, SPA fallback verification, manifest print.
 *   (default)   require the three credentials and run the real deploy.
 *
 * Required credentials for a real deploy (each named when missing):
 *   CLOUDFLARE_API_TOKEN       Pages edit permission
 *   CLOUDFLARE_ACCOUNT_ID      the Cloudflare account
 *   CLOUDFLARE_PAGES_PROJECT   the Pages project name
 *
 * The SPA fallback is Pages' built-in single-page-app behavior; this script
 * verifies the precondition (dist/index.html at the deploy root) instead of
 * configuring rewrites (plan D2).
 *
 * Secrets: only VITE_* vars are inlined by Vite. This script never exports
 * SUPABASE_DB_URL or any service-role credential — the guard suite asserts
 * that property statically (tests/unit/production.guard.test.ts).
 *
 * Usage: node scripts/deploy-frontend.mjs [--dry-run]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

const DIST_DIR = 'dist'
const REQUIRED_CREDENTIALS = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_PAGES_PROJECT',
]

function fail(message) {
  console.error(`[deploy] ${message}`)
  process.exit(1)
}

/** Walk dist and return { path, bytes } for every file, POSIX-style paths. */
export function collectManifest(dir = DIST_DIR, base = dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      entries.push(...collectManifest(full, base))
    } else {
      const rel = relative(base, full).split('\\').join('/')
      entries.push({ path: rel, bytes: statSync(full).size })
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

/** The deployment contract's preconditions, shared by both modes. */
export function validateBundle(dir = DIST_DIR) {
  if (!existsSync(dir)) {
    return { ok: false, reason: `missing build output "${dir}" — run \`npm run build\` first` }
  }
  const indexPath = join(dir, 'index.html')
  if (!existsSync(indexPath)) {
    return {
      ok: false,
      reason: `dist/index.html missing at the deploy root — the SPA fallback precondition (plan D2)`,
    }
  }
  const index = readFileSync(indexPath, 'utf8')
  if (!/<div id="root">/.test(index)) {
    return { ok: false, reason: 'dist/index.html does not mount the app root — wrong bundle?' }
  }
  return { ok: true, manifest: collectManifest(dir) }
}

/**
 * Credential resolution (exported for the guard suite): returns which
 * required vars are missing. Dry-run mode deliberately ignores them.
 */
export function missingCredentials(env = process.env) {
  return REQUIRED_CREDENTIALS.filter((name) => !env[name] || env[name].trim() === '')
}

function main() {
  const dryRun = process.argv.includes('--dry-run')

  const bundle = validateBundle()
  if (!bundle.ok) fail(bundle.reason)
  console.log(
    `[deploy] bundle OK — ${bundle.manifest.length} files, SPA fallback precondition met (dist/index.html at root)`,
  )

  const missing = missingCredentials()
  if (dryRun) {
    console.log(
      '[deploy] --dry-run: no credentials needed; this is exactly what a real deploy would upload:',
    )
    for (const file of bundle.manifest) {
      console.log(`  ${file.path} (${file.bytes} bytes)`)
    }
    const wouldNeed = missing.length
    console.log(
      wouldNeed === 0
        ? '[deploy] credentials present — a real deploy would run `wrangler pages deploy dist` now'
        : `[deploy] dry-run ends here: ${wouldNeed} credential(s) unset — a real deploy would refuse and name them`,
    )
    return
  }

  if (missing.length > 0) {
    fail(
      `refusing to deploy — missing required credential(s): ${missing.join(', ')}. ` +
        'Set them in the environment (see docs/production-runbook.md → Deployment).',
    )
  }

  let wrangler
  try {
    wrangler = require.resolve('wrangler/bin/wrangler.js')
  } catch {
    fail(
      'wrangler is not installed — it is a deploy-time-only devDependency. ' +
        'Run `npm install` (or `npm i -D wrangler`) and retry.',
    )
  }

  const project = process.env.CLOUDFLARE_PAGES_PROJECT
  console.log(`[deploy] deploying dist/ to Cloudflare Pages project "${project}"…`)
  try {
    execFileSync(
      process.execPath,
      [wrangler, 'pages', 'deploy', DIST_DIR, '--project-name', project],
      {
        stdio: 'inherit',
        env: process.env,
      },
    )
  } catch (error) {
    fail(
      `wrangler deploy failed (exit ${error.status}) — see wrangler output above; rollback: docs/production-runbook.md → Rollback`,
    )
  }
  console.log(
    `[deploy] done — https://${project}.pages.dev (custom domain: runbook → Deployment → Custom domain)`,
  )
}
// Execute only when run directly — importing this module (the guard suite
// imports it) must have no side effects.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
