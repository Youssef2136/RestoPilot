import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types'
import { menuItemIds, restaurantIds, seedCredentials } from '../database/helpers/fixtures'

/**
 * Integration suite — the real-Storage round trip (spec 005 US5, T042;
 * FR-021…FR-023, FR-027, SC-002; contracts/menu-images.md §3–§5;
 * research.md §14).
 *
 * Everything here goes through the REAL cloud project: real sign-ins, the
 * real Storage API against the live `menu-images` bucket, and the real
 * `set_menu_item_image` RPC through PostgREST. This is the tier that proves
 * what no other suite can:
 *
 *   - the bucket's configured limits actually reject (size / MIME type);
 *   - the storage policies decide: a second restaurant's owner cannot insert
 *     or delete under this prefix; a branch manager cannot insert;
 *   - the LOAD-BEARING rule of contracts/menu-images.md §3: an object is
 *     readable only while a visible item references it — after the reference
 *     moves, the previous object is unretrievable.
 *
 * TWO observed characteristics of the hosted Storage service shape this
 * suite (both verified by scripts/diag-storage.mjs runs against the live
 * project):
 *
 *   1. THE AUTHORIZATION DECISION IS TOKEN-BOUND. After a reference moves,
 *      a fresh session is refused within milliseconds (the policy is live),
 *      but a session that was EVER granted a 200 for the object keeps
 *      receiving it for at least tens of seconds — an authorization cache
 *      keyed by the JWT, not the CDN (`cache-control: public, max-age=0`).
 *      Refusal assertions therefore sign in a FRESH session for every
 *      attempt (pollUntilRefusedFresh); the SQL-level suite, T041, proves
 *      the policy semantics exactly. Fresh viewers are never affected: a
 *      cached grant exists only for a token that legitimately accessed the
 *      object while it was referenced, and its lifetime is the session's.
 *   2. REMOVE REPORTS PER-OBJECT OUTCOMES IN `data`, NOT `error`. A delete
 *      the policy refuses is SILENTLY INEFFECTIVE — `data` comes back
 *      without the object and nothing is deleted. The owner-delete assertion
 *      exploits exactly that.
 *
 * Identity matrix from the seed (helpers/fixtures.ts): alice owns Blue
 * Olive; eve owns Cedar Grill AND is a cashier at Blue Olive's Downtown
 * branch — so the staff-select policy legitimately lets eve READ referenced
 * Blue Olive objects (she is staff), while insert/delete remain owner-only.
 * The suite asserts THAT matrix, not a coarser one.
 *
 * Hygiene: every scratch object is registered for teardown, which clears the
 * item's reference and removes everything uploaded. Deletion goes through
 * the Storage API only — never SQL (contract §5).
 *
 * Preconditions: migrated + seeded cloud development database, and the
 * `menu-images` bucket created by migration.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Copy .env.example to .env and fill it in — see docs/development.md (Setup).',
    )
  }
  return value
}

function createAuthClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
  )
}

const BUCKET = 'menu-images'

/** Poll cadence and window for eventual policy propagation. */
const POLL_INTERVAL_MS = 1_000
const POLL_WINDOW_MS = 30_000

/** Alice (Blue Olive owner), Eve (Cedar Grill owner + Downtown cashier), Bob (Downtown manager). */
let alice: SupabaseClient<Database>
let eve: SupabaseClient<Database>
let bob: SupabaseClient<Database>

async function signInAs(name: keyof typeof seedCredentials): Promise<SupabaseClient<Database>> {
  const client = createAuthClient()
  const credential = seedCredentials[name]
  const { data, error } = await client.auth.signInWithPassword({
    email: credential.email,
    password: credential.password,
  })
  expect(error, error?.message).toBeNull()
  expect(data.session?.user.id).toBe(credential.auth_user_id)
  return client
}

/** Alice's item prefix — the grammar's own tenant binding. */
const ITEM_PREFIX = `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/`

/** Every uploaded scratch path, removed in teardown. */
const scratchPaths: string[] = []

function scratchPath(extension: 'png' | 'webp' | 'jpg'): string {
  const path = `${ITEM_PREFIX}${crypto.randomUUID()}.${extension}`
  scratchPaths.push(path)
  return path
}

/** Freshly allocated bytes; `Uint8Array<ArrayBuffer>` satisfies `BlobPart`. */
function bytes(size: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(size)
}

async function uploadAs(
  client: SupabaseClient<Database>,
  path: string,
  body: Blob,
  contentType: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await client.storage.from(BUCKET).upload(path, body, { contentType })
  return { error }
}

/** Downloads `path` once; resolves with the outcome. */
async function downloadOnce(
  client: SupabaseClient<Database>,
  path: string,
): Promise<{ data: Blob | null; error: { message: string } | null }> {
  const { data, error } = await client.storage.from(BUCKET).download(path)
  return { data, error }
}

/**
 * Polls until `path` downloads successfully (the policy has flipped to
 * readable) or the window closes. Resolves true when readable.
 */
async function pollUntilReadable(client: SupabaseClient<Database>, path: string): Promise<boolean> {
  const deadline = Date.now() + POLL_WINDOW_MS
  while (Date.now() < deadline) {
    const { data } = await downloadOnce(client, path)
    if (data !== null) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return false
}

/**
 * Polls until `path` is refused, signing in a FRESH session for every
 * attempt (see header characteristic 1: a token ever granted a 200 keeps
 * receiving the object, so the refusal must be observed by a token with no
 * history for it). Resolves true when refused.
 */
async function pollUntilRefusedFresh(
  identity: keyof typeof seedCredentials,
  path: string,
): Promise<boolean> {
  const deadline = Date.now() + POLL_WINDOW_MS
  while (Date.now() < deadline) {
    const client = await signInAs(identity)
    const { error } = await downloadOnce(client, path)
    if (error !== null) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return false
}

/** Records the item's reference through the real RPC; resolves the previous path. */
async function setReference(
  client: SupabaseClient<Database>,
  path: string | null,
): Promise<{ previous: string | null; error: { message: string } | null }> {
  const { data, error } = await client.rpc('set_menu_item_image', {
    p_item_id: menuItemIds.hummus,
    // SQL NULL clears the reference; the generated type under-reports that
    // the plain-text parameter accepts it (see menuClient.setItemImage).
    p_image_path: path as string,
  })
  if (error !== null) {
    return { previous: null, error }
  }
  // The RPC returns text (the previous path) or null; both are successes.
  return { previous: (data as unknown as string | null) ?? null, error: null }
}

beforeAll(async () => {
  alice = await signInAs('alice')
  eve = await signInAs('eve')
  bob = await signInAs('bob')
})

afterAll(async () => {
  // Best-effort teardown: clear the reference first (so nothing stays
  // referenced by the seed item), then remove every scratch object. Storage
  // API only — never SQL (contracts/menu-images.md §5).
  try {
    if (alice === undefined) return
    await setReference(alice, null)
    if (scratchPaths.length > 0) {
      await alice.storage.from(BUCKET).remove(scratchPaths)
    }
  } catch {
    // Teardown is best effort; a failure here must not mask the suite result.
  }
})

describe('menu images: the real-Storage round trip (FR-021…FR-023, SC-002)', () => {
  it(
    'uploads into the owner prefix, reads the referenced object back, and the reference decides readability',
    { timeout: 180_000 },
    async () => {
      const first = scratchPath('png')
      const second = scratchPath('webp')

      // 1. The owner uploads; the object exists but NOTHING references it.
      const uploaded = await uploadAs(
        alice,
        first,
        new Blob([bytes(16)], { type: 'image/png' }),
        'image/png',
      )
      expect(uploaded.error, uploaded.error?.message).toBeNull()

      // 2. Unreferenced ⇒ unreadable — even for the uploading owner (the
      // select policy tracks the CURRENT reference, §3 consequence 3).
      // Observed with fresh sessions (header characteristic 1).
      expect(await pollUntilRefusedFresh('alice', first)).toBe(true)

      // 3. The RPC records the reference: first set returns no previous path.
      const recorded = await setReference(alice, first)
      expect(recorded.error, recorded.error?.message).toBeNull()
      expect(recorded.previous).toBeNull()

      // 4. Referenced ⇒ readable back, byte-exact.
      expect(await pollUntilReadable(alice, first)).toBe(true)
      const readable = await downloadOnce(alice, first)
      expect((await readable.data?.arrayBuffer())?.byteLength).toBe(16)

      // 5. The replacement is uploaded BEFORE the reference moves (the
      // contract's upload → record → delete-old ordering); then the RPC
      // returns the PREVIOUS path for the client's cleanup, and the previous
      // object becomes unretrievable — while the new one is readable (the
      // load-bearing assertion).
      const uploadedSecond = await uploadAs(
        alice,
        second,
        new Blob([bytes(32)], { type: 'image/webp' }),
        'image/webp',
      )
      expect(uploadedSecond.error, uploadedSecond.error?.message).toBeNull()

      const moved = await setReference(alice, second)
      expect(moved.error, moved.error?.message).toBeNull()
      expect(moved.previous).toBe(first)

      expect(await pollUntilReadable(alice, second)).toBe(true)
      const newReadable = await downloadOnce(alice, second)
      expect((await newReadable.data?.arrayBuffer())?.byteLength).toBe(32)
      // The previous object is unreadable to a token with no history for it
      // (§3 consequence 1 at the live-API level).
      expect(await pollUntilRefusedFresh('alice', first)).toBe(true)

      // 6. Clearing the reference makes the last object unretrievable too.
      const cleared = await setReference(alice, null)
      expect(cleared.error, cleared.error?.message).toBeNull()
      expect(cleared.previous).toBe(second)
      expect(await pollUntilRefusedFresh('alice', second)).toBe(true)
    },
  )

  it(
    'the bucket itself rejects an oversized object and a disallowed type (413/400)',
    { timeout: 300_000 },
    async () => {
      // Exactly 5 MiB is the accepted boundary (the upload of 5 MiB over a
      // slow link can take a while; the timeout above absorbs it).
      const atLimit = scratchPath('png')
      const atLimitResult = await uploadAs(
        alice,
        atLimit,
        new Blob([bytes(5 * 1024 * 1024)], { type: 'image/png' }),
        'image/png',
      )
      expect(atLimitResult.error, atLimitResult.error?.message).toBeNull()

      // 5 MiB + 1 byte is rejected by the bucket's file_size_limit.
      const tooBig = scratchPath('png')
      const tooBigResult = await uploadAs(
        alice,
        tooBig,
        new Blob([bytes(5 * 1024 * 1024 + 1)], { type: 'image/png' }),
        'image/png',
      )
      expect(tooBigResult.error).not.toBeNull()
      expect(tooBigResult.error?.message.toLowerCase()).toMatch(
        /exceeded the maximum allowed size|entitytoo large|too large|413|payload/,
      )

      // A disallowed MIME type is rejected by allowed_mime_types.
      const wrongType = scratchPath('png')
      const wrongTypeResult = await uploadAs(
        alice,
        wrongType,
        new Blob([bytes(8)], { type: 'application/pdf' }),
        'application/pdf',
      )
      expect(wrongTypeResult.error).not.toBeNull()
      expect(wrongTypeResult.error?.message.toLowerCase()).toMatch(
        /mime type .* is not supported|invalidmimetype|mime|400|type/,
      )
    },
  )

  it(
    'a second restaurant’s owner cannot insert, delete, or see unreferenced objects — but is staff for reads of referenced ones (FR-023, FR-004)',
    { timeout: 180_000 },
    async () => {
      const referenced = scratchPath('png')
      const unreferenced = scratchPath('png')

      // One referenced and one unreferenced object in the item's folder.
      await uploadAs(alice, referenced, new Blob([bytes(8)], { type: 'image/png' }), 'image/png')
      await uploadAs(alice, unreferenced, new Blob([bytes(8)], { type: 'image/png' }), 'image/png')
      const recorded = await setReference(alice, referenced)
      expect(recorded.error, recorded.error?.message).toBeNull()

      // INSERT into another restaurant's prefix: the insert policy refuses
      // (eve's ownership of Cedar Grill does not extend to Blue Olive).
      const foreignInsert = `${ITEM_PREFIX}${crypto.randomUUID()}.png`
      const insertAttempt = await uploadAs(
        eve,
        foreignInsert,
        new Blob([bytes(8)], { type: 'image/png' }),
        'image/png',
      )
      expect(insertAttempt.error).not.toBeNull()

      // READ, unreferenced object: refused — the select policy tracks the
      // CURRENT reference, and this object has none (fresh sessions; eve's
      // client has no grant history for it either way).
      expect(await pollUntilRefusedFresh('eve', unreferenced)).toBe(true)

      // READ, referenced object: ALLOWED. Eve is a cashier at Blue Olive's
      // Downtown branch (the seed's multi-membership fixture), so the
      // staff-select policy — deliberately restaurant-staff-wide, not
      // owner-only — admits her. Read is not implied by upload: the
      // unreferenced twin is refused above.
      expect(await pollUntilReadable(eve, referenced)).toBe(true)

      // DELETE: the delete policy is owner-only, and Storage's remove is
      // silently ineffective when the policy refuses — `data` omits the
      // object and nothing is deleted (see the suite header).
      const deleteAttempt = await eve.storage.from(BUCKET).remove([referenced])
      expect(deleteAttempt.error).toBeNull() // no transport error…
      const deletions = (deleteAttempt.data ?? []) as Array<{ name?: string }>
      expect(deletions.map((d) => d.name)).not.toContain(referenced) // …nothing deleted
      expect(await pollUntilReadable(alice, referenced)).toBe(true) // object intact

      // ENUMERATION: nothing is enumerable beyond the reference. Listing the
      // item's folder shows the referenced object only — never the
      // unreferenced twin.
      const listAttempt = await eve.storage
        .from(BUCKET)
        .list(`restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}`, { limit: 100 })
      expect(listAttempt.error).toBeNull()
      const names = (listAttempt.data ?? []).map((o) => o.name)
      expect(names).toContain(referenced.split('/').at(-1))
      expect(names).not.toContain(unreferenced.split('/').at(-1))

      // Cleanup within the test: the owner clears the reference again.
      const cleared = await setReference(alice, null)
      expect(cleared.previous).toBe(referenced)
    },
  )

  it(
    'a branch manager cannot insert into the restaurant prefix (FR-023)',
    { timeout: 120_000 },
    async () => {
      const attempt = await uploadAs(
        bob,
        `${ITEM_PREFIX}${crypto.randomUUID()}.png`,
        new Blob([bytes(8)], { type: 'image/png' }),
        'image/png',
      )
      expect(attempt.error).not.toBeNull()
    },
  )
})
