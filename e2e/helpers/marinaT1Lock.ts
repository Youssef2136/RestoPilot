import { mkdir, rm, stat } from 'node:fs/promises'

/**
 * Cross-worker mutex for the seeded Marina T1 activation fixture.
 *
 * The seed defines Marina's T1 as INACTIVE. Two specs flip that state
 * through the real UI: realtime's kitchen-queue test reactivates it (and
 * deactivates it in ITS teardown), management.surfaces asserts the seeded
 * INACTIVE state. Under fullyParallel those collide in both directions
 * (assert sees Active / click hits "Deactivate" when it expects
 * "Reactivate"). The lock serializes the whole T1 lifecycle machine-wide;
 * everything else stays fully parallel (same pattern as fionaLock /
 * entryLock).
 */
const LOCK_DIR = 'test-results/.marina-t1.lock'
const POLL_MS = 250
const TIMEOUT_MS = 180_000
const STALE_MS = 300_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Runs `fn` while holding the Marina T1 fixture lock. */
export async function withMarinaT1Lock<T>(fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  for (;;) {
    try {
      await mkdir(LOCK_DIR)
      break
    } catch {
      if (Date.now() - start > TIMEOUT_MS) {
        throw new Error('marina-t1 lock: timed out waiting for the fixture lock')
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
  try {
    return await fn()
  } finally {
    await rm(LOCK_DIR, { recursive: true, force: true })
  }
}
