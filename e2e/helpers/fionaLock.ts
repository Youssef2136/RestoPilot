import { mkdir, rm, stat } from 'node:fs/promises'

/**
 * Cross-worker mutex for the SHARED Fiona fixture.
 *
 * fullyParallel runs every spec file concurrently, and two files fight over
 * the same seeded identity: auth.routes' password walkthrough POISONS
 * fiona@restopilot.dev (temp password) for the span of its walkthrough, while
 * management.surfaces / full-journey sign that identity in (and the journey
 * makes her a real owner, which hides the management suite's creation-panel
 * assertions). The lock serializes ALL Fiona usage machine-wide: sign-ins
 * take it briefly, the walkthrough holds it across the poisoned span, and the
 * journey holds it for its whole run. Everything else stays fully parallel.
 *
 * Implementation: an atomic mkdir on a lock directory under test-results/
 * (gitignored), polling with a bounded wait; a lock older than STALE_MS is
 * stolen (a crashed worker must not wedge the suite).
 */
const LOCK_DIR = 'test-results/.fiona.lock'
const POLL_MS = 250
const TIMEOUT_MS = 420_000
const STALE_MS = 600_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Polls until the lock can be created atomically, then holds it. */
async function acquire(): Promise<void> {
  const start = Date.now()
  for (;;) {
    try {
      await mkdir(LOCK_DIR)
      return
    } catch {
      if (Date.now() - start > TIMEOUT_MS) {
        throw new Error('fiona lock: timed out waiting for the fixture lock')
      }
      try {
        const info = await stat(LOCK_DIR)
        if (Date.now() - info.mtimeMs > STALE_MS) {
          await rm(LOCK_DIR, { recursive: true, force: true })
        }
      } catch {
        // vanished between mkdir and stat — just retry
      }
      await sleep(POLL_MS)
    }
  }
}

async function release(): Promise<void> {
  await rm(LOCK_DIR, { recursive: true, force: true })
}

/** Runs `fn` while holding the shared-fixture lock. */
export async function withFionaLock<T>(fn: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await fn()
  } finally {
    await release()
  }
}

/**
 * Long-span form for a test that must hold the lock ACROSS its whole body
 * (serial suites spanning several tests): acquire at the start, call the
 * returned disposer in a finally. Prefer `withFionaLock` elsewhere.
 */
export async function acquireFionaLock(): Promise<() => Promise<void>> {
  await acquire()
  let released = false
  return async () => {
    if (!released) {
      released = true
      await release()
    }
  }
}
