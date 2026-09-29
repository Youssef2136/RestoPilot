import { mkdir, rm, stat } from 'node:fs/promises'

/**
 * Cross-worker mutex for the SHARED Blue Olive customer-entry surface.
 *
 * fullyParallel runs every spec file concurrently, and platform.surfaces'
 * disable/re-enable test flips the platform kill-switch on Blue Olive for
 * its span — `open_session_*` refuses with "This restaurant is not
 * available." while disabled, which breaks ANY concurrent spec's customer
 * entry into the same restaurant (staff surfaces are unaffected: the
 * disabled banner is informational by design).
 *
 * The lock serializes the ENTRY flows machine-wide: platform holds it
 * across the whole disable→assert→re-enable dance; every other file's
 * customer-entry helper takes it briefly around its submit. Everything
 * else stays fully parallel (the fionaLock pattern at a second resource).
 *
 * Implementation: an atomic mkdir on a lock directory under test-results/
 * (gitignored), polling with a bounded wait; a stale lock is stolen so a
 * crashed worker cannot wedge the suite.
 */
const LOCK_DIR = 'test-results/.entry.lock'
const POLL_MS = 250
const TIMEOUT_MS = 120_000
const STALE_MS = 180_000

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
        throw new Error('entry lock: timed out waiting for the Blue Olive entry lock')
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

/** Runs `fn` while holding the shared entry lock. */
export async function withEntryLock<T>(fn: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await fn()
  } finally {
    await release()
  }
}

/**
 * Long-span form for a file that must hold the lock ACROSS its whole run
 * (the platform suite spans disable→…→re-enable): acquire in beforeAll,
 * release the returned disposer in afterAll. Prefer `withEntryLock` elsewhere.
 */
export async function acquireEntryLock(): Promise<() => Promise<void>> {
  await acquire()
  let released = false
  return async () => {
    if (!released) {
      released = true
      await release()
    }
  }
}
