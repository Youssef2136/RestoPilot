import { mkdir, rm, stat } from 'node:fs/promises'

/**
 * Cross-file mutex for the SHARED Downtown T2 customer fixture.
 *
 * The parallel suite (fullyParallel) runs every spec file concurrently on the
 * shared seeded database, and two files' customer journeys share T2:
 * `customer.menu` (serial: one session whose 'Your rounds' region asserts
 * exact bill shapes) and `reports.surfaces` (joins as a fresh 'E2E Customer'
 * and submits rounds for report anchors). When their spans overlap, the
 * reports rounds land in the customer menu suite's session and the exact
 * Subtotal assertions meet multiple <dt>Subtotal</dt> elements — the strict
 * mode violation that surfaced when this phase's new file shifted the worker
 * scheduling. The lock serializes the two files' T2 spans machine-wide
 * (the fionaLock precedent); everything else stays fully parallel.
 *
 * Implementation: the same atomic-mkdir + stale-steal pattern as fionaLock.
 */
const LOCK_DIR = 'test-results/.t2.lock'
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
        throw new Error('t2 lock: timed out waiting for the shared-table lock')
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

/** Runs `fn` while holding the shared T2 lock (spans the whole T2 journey). */
export async function withT2Lock<T>(fn: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await fn()
  } finally {
    await release()
  }
}
