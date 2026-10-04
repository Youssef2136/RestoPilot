import { mkdir, rm, stat } from 'node:fs/promises'

/**
 * Cross-file mutex for the SHARED subscriptions row (specs/032 D7).
 *
 * The parallel suite (fullyParallel) runs every spec file concurrently on
 * the shared seeded database, and the tenant's single subscriptions row is
 * mutated by date-flipping journeys: `platform.surfaces` (activate →
 * expired; the kill-switch window rides entryLock separately) and
 * `live.awareness` (this phase's nearing_expiration journey). When two date
 * flips overlap, the second Save lands on the first's read and the banner
 * state assertions race. The lock serializes the DATE-FLIP spans
 * machine-wide (the t2Lock/fionaLock precedent); everything else stays
 * fully parallel.
 *
 * Implementation: the same atomic-mkdir + stale-steal pattern as t2Lock.
 */
const LOCK_DIR = 'test-results/.subscription.lock'
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
        throw new Error('subscription lock: timed out waiting for the shared-row lock')
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

/** Runs `fn` while holding the shared subscriptions-row lock (date flips). */
export async function withSubscriptionLock<T>(fn: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await fn()
  } finally {
    await release()
  }
}
