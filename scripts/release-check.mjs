#!/usr/bin/env node
/**
 * spec 040 T006 — the deterministic release-check script (FR-10/SC-002):
 * the release gates that are pure repository facts, re-run in one command:
 *   1. the production guard suite (the .env gitignore + seed boundary +
 *      deploy-script contract + bundle inlining rule),
 *   2. the bundle-split manifest gate (chunk-class membership + per-route
 *      budget re-read from dist/.vite/manifest.json — sizes recorded here,
 *      hard facts asserted),
 *   3. the release artifacts' structural gates (deploy rehearsal record,
 *      production-runbook sections, release-notes, checklist dispositions),
 *   4. the deploy rehearsal invocation itself (--dry-run must exit 0 on a
 *      built dist).
 * Deterministic only (plan D4): no timing, no cloud latency, no network —
 * the 038 rule. Run `npm run build` first; fails loudly otherwise.
 *
 * Usage: node scripts/release-check.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const root = process.cwd()
let failures = 0
const ok = (label) => console.log(`  ✓ ${label}`)
const fail = (label, detail) => {
  failures++
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
}
const check = (cond, label, detail) => (cond ? ok(label) : fail(label, detail))

console.log('release:check — the deterministic release gates (spec 040 T006)')

// ── 0. The build artifact must exist (npm run build first). ──────────────
const manifestPath = resolve(root, 'dist/.vite/manifest.json')
const distIndex = resolve(root, 'dist/index.html')
check(existsSync(manifestPath), 'dist/.vite/manifest.json exists', 'run `npm run build` first')
check(existsSync(distIndex), 'dist/index.html at the deploy root (SPA fallback precondition)')

if (failures === 0) {
  // ── 1. The production guard suite. ────────────────────────────────────
  console.log('\n1. the production guard suite')
  try {
    execFileSync(
      'node',
      ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/production.guard.test.ts'],
      {
        stdio: 'pipe',
        encoding: 'utf8',
      },
    )
    ok('production.guard.test.ts green (seed boundary, .env gitignore, inlining rule)')
  } catch (error) {
    fail(
      'production.guard.test.ts',
      String(error.stdout ?? error.message)
        .split('\n')
        .slice(-12)
        .join('\n'),
    )
  }

  // ── 2. The bundle facts: chunk classes + per-route budget re-read. ────
  console.log('\n2. the bundle facts (manifest re-read)')
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const routeChunks = Object.values(manifest).filter(
      (entry) => typeof entry.src === 'string' && entry.src.startsWith('src/routes/'),
    )
    check(routeChunks.length >= 20, `route chunks present (${routeChunks.length} ≥ 20)`)

    // Chunk-class membership (the 038 hard rule re-read from the manifest's
    // import graphs): customer chunks import no staff/admin-only module.
    const STAFF_MARKERS = ['managementClient', 'platformClient', 'usePlatform']
    const CUSTOMER_MARKERS = ['menuClient', 'sessionClient']
    const files = new Map()
    for (const [key, entry] of Object.entries(manifest)) {
      if (entry.file) files.set(key, entry)
    }
    const importsOf = (key, seen = new Set()) => {
      for (const imp of files.get(key)?.imports ?? []) {
        if (!seen.has(imp)) {
          seen.add(imp)
          importsOf(imp, seen)
        }
      }
      return seen
    }
    let leak = null
    for (const [key, entry] of Object.entries(manifest)) {
      if (typeof entry.src !== 'string') continue
      const reach = importsOf(key)
      const reachNames = [...reach].map((k) => files.get(k)?.file ?? k).join(' ')
      if (entry.src.includes('routes/customer') || entry.src.includes('CustomerMenu')) {
        const hit = STAFF_MARKERS.find((m) => reachNames.includes(m))
        if (hit) leak = `customer chunk ${key} reaches staff marker ${hit}`
      }
      if (
        entry.src.includes('routes/admin') ||
        entry.src.includes('routes/management') ||
        entry.src.includes('PlatformConsole')
      ) {
        const hit = CUSTOMER_MARKERS.find((m) => reachNames.includes(m))
        if (hit) leak = `staff/admin chunk ${key} reaches customer marker ${hit}`
      }
    }
    check(leak === null, 'chunk-class membership clean (no cross-class leak)', leak ?? undefined)

    // Per-route budget re-read (sizes recorded; informational per 038).
    const bundleSplitPath = resolve(root, 'tests/unit/bundleSplit.test.ts')
    check(
      existsSync(bundleSplitPath) && statSync(bundleSplitPath).size > 0,
      'the bundleSplit gate file present',
    )
    try {
      execFileSync(
        'node',
        ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/bundleSplit.test.ts'],
        {
          stdio: 'pipe',
          encoding: 'utf8',
        },
      )
      ok('bundleSplit.test.ts green (the hard class gate)')
    } catch (error) {
      fail('bundleSplit.test.ts', String(error.stdout ?? error.message).slice(-400))
    }
  } catch (error) {
    fail('manifest read', error.message)
  }

  // ── 3. The release artifacts' structural gates. ───────────────────────
  console.log('\n3. the release artifacts')
  const read = (rel) => readFileSync(resolve(root, rel), 'utf8')
  try {
    const rehearsal = read('specs/040-frontend-release-readiness/deploy-rehearsal.md')
    check(
      /bundle OK|SPA fallback precondition met/.test(rehearsal),
      'deploy-rehearsal.md records the dry-run proof',
    )
    const runbook = read('docs/production-runbook.md')
    check(/What CANNOT be rolled back/.test(runbook), 'runbook names the non-rollbackables (FR-09)')
    check(
      /Error tracking/i.test(runbook) || /error tracking/i.test(runbook),
      'runbook records the error-tracking posture (FR-08)',
    )
    check(
      /URL Configuration/.test(runbook),
      'runbook records the auth redirect operator step (FR-06)',
    )
    check(/immutable/i.test(runbook), 'runbook records the caching posture (FR-07)')
    const notes = read('specs/040-frontend-release-readiness/release-notes.md')
    check(notes.length > 1000, `release-notes.md substantive (${notes.length} bytes, FR-12)`)
    const checklist = read('specs/040-frontend-release-readiness/release-checklist.md')
    const rows = checklist.split('\n').filter((l) => /^\| \d+ /.test(l)).length
    const wired = checklist
      .split('\n')
      .filter(/wired|operator|n\/a/.test.bind(/wired|operator|n\/a/)).length
    check(rows >= 12, `checklist carries ${rows} ≥ 12 rows (FR-10)`)
    check(wired >= rows, 'every checklist row carries a disposition')
  } catch (error) {
    fail('release artifacts', error.message)
  }

  // ── 4. The deploy rehearsal must exit 0 on this tree. ─────────────────
  console.log('\n4. the deploy rehearsal (--dry-run)')
  try {
    execFileSync('node', ['scripts/deploy-frontend.mjs', '--dry-run'], {
      stdio: 'pipe',
      encoding: 'utf8',
    })
    ok('deploy --dry-run exit 0 (the real deploy would upload exactly this manifest)')
  } catch (error) {
    fail('deploy --dry-run', String(error.stdout ?? error.message).slice(-400))
  }
}

console.log(
  failures === 0
    ? '\nrelease:check GREEN — the deterministic release gates hold.'
    : `\nrelease:check FAILED — ${failures} gate(s) red.`,
)
process.exit(failures === 0 ? 0 : 1)
