/**
 * Menu image lifecycle (contracts/menu-images.md §2, §4; spec 005 US5,
 * FR-021–FR-023) — the project's first Storage surface.
 *
 * The module owns three things and nothing more:
 *   1. the path grammar `restaurant/<restaurant_id>/item/<item_id>/<name>.<ext>`
 *      — the tenant binding AND the object's identity (§2);
 *   2. the client pre-checks (MIME type in the allowed set, size ≤ 5 MiB) —
 *      immediate feedback only; the bucket remains the authority;
 *   3. the upload → record → delete-old ordering (§4): every intermediate
 *      state has a defined rendering and the item never references a missing
 *      object. Cleanup is always a Storage-API delete, never SQL (§5).
 *
 * Authorization is entirely server-side: the insert/delete policies scope the
 * prefix, the RPC re-validates the path, and signing is subject to the select
 * policy. This module carries no policy logic of its own.
 */

/** The bucket every menu image lives in (created by migration). */
export const MENU_IMAGES_BUCKET = 'menu-images'

/** The bucket's configured limit (5 MiB) — mirrored for pre-flight feedback. */
export const MENU_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** The exact MIME types the bucket accepts. */
export const MENU_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type MenuImageMimeType = (typeof MENU_IMAGE_MIME_TYPES)[number]

/** File extension for each accepted MIME type (the grammar's `<ext>` set). */
const EXTENSION_BY_MIME: Record<MenuImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** The grammar's `<name>` segment. */
const NAME_PATTERN = /^[A-Za-z0-9._-]{1,120}$/

/** Pre-check failures, each naming the bound that failed (contract §4). */
export type MenuImagePrecheckError =
  { kind: 'type'; message: string } | { kind: 'size'; message: string }

export function isMenuImageMimeType(value: string): value is MenuImageMimeType {
  return (MENU_IMAGE_MIME_TYPES as readonly string[]).includes(value)
}

/**
 * The §4 pre-check: type first, then size. `null` means acceptable — the
 * upload may proceed (the bucket re-decides both).
 */
export function precheckMenuImage(file: {
  type: string
  size: number
}): MenuImagePrecheckError | null {
  if (!isMenuImageMimeType(file.type)) {
    return {
      kind: 'type',
      message: 'Images must be JPEG, PNG, or WebP.',
    }
  }
  if (file.size > MENU_IMAGE_MAX_BYTES) {
    return {
      kind: 'size',
      message: 'Images must be 5 MB or smaller.',
    }
  }
  return null
}

/**
 * The §2 path: `restaurant/<restaurant_id>/item/<item_id>/<name>.<ext>`.
 * `restaurant_id` and `item_id` are the literal UUIDs of the owning rows and
 * `<name>` is a fresh UUID, so every upload lands on its own object and a
 * path can only ever be built inside the item's own prefix.
 */
export function buildMenuImagePath(input: {
  restaurantId: string
  itemId: string
  mimeType: MenuImageMimeType
  /** Defaults to a fresh UUID (the §4 flow); callers may pass a fixed name for tests. */
  name?: string
}): string {
  const name = input.name ?? crypto.randomUUID()
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Image name must match ${NAME_PATTERN.source}.`)
  }
  const extension = EXTENSION_BY_MIME[input.mimeType]
  return `restaurant/${input.restaurantId}/item/${input.itemId}/${name}.${extension}`
}

/** True when `path` is exactly the item's own prefix + a grammar-valid name. */
export function isMenuImagePathForItem(
  path: string,
  restaurantId: string,
  itemId: string,
): boolean {
  const prefix = `restaurant/${restaurantId}/item/${itemId}/`
  if (!path.startsWith(prefix)) {
    return false
  }
  const name = path.slice(prefix.length)
  return NAME_PATTERN.test(name) && /\.(jpg|jpeg|png|webp)$/.test(name)
}

/** The object path, or null when the item has no image. */
export function objectPathOf(imagePath: string | null | undefined): string | null {
  return imagePath === null || imagePath === undefined || imagePath === '' ? null : imagePath
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage access (the client's ONLY Storage calls in the menu module)
// ─────────────────────────────────────────────────────────────────────────────

interface StorageClientLike {
  from(bucket: string): {
    upload(
      path: string,
      body: Blob,
      options?: { contentType?: string },
    ): Promise<{
      data: unknown
      error: { message: string } | null
    }>
    remove(paths: string[]): Promise<{ error: { message: string } | null }>
    createSignedUrl(
      path: string,
      expiresIn: number,
    ): Promise<{
      data?: { signedUrl?: string } | null
      error: { message: string } | null
    }>
  }
}

/**
 * Failure kinds of the orchestration, mapped 1:1 from contract §4's table.
 * `upload` and `record` carry the server's own message; `cleanup` failure is
 * deliberately NOT user-facing (the item is already correct and the old
 * object already unreadable) but is reported for observability.
 */
export type MenuImageFailure =
  | { stage: 'upload'; message: string }
  | { stage: 'record'; message: string }
  | { stage: 'cleanup'; message: string }

export type MenuImageOutcome =
  | { ok: true; /** The recorded path (the new object). */ path: string }
  | { ok: false; failure: MenuImageFailure }

export interface MenuImageStorage {
  /** The Storage-API surface this module uses (subset of the real client). */
  storage: StorageClientLike
  /** Records (or clears) the reference; resolves the PREVIOUS path on success. */
  setImagePath: (
    itemId: string,
    path: string | null,
  ) => Promise<{
    ok: boolean
    message?: string
    /** The previous path — null on first set and on a no-op. */
    previousPath: string | null
  }>
}

/**
 * Add/replace (contract §4): pre-check, upload, record, best-effort delete of
 * the returned previous object — in that order, stopping at the first
 * failure. On upload failure the item is untouched; on record failure the
 * uploaded object is unreferenced (hence unreadable) and the caller may retry
 * the SAME path (§4's failure table).
 */
export async function uploadMenuImage(
  storage: MenuImageStorage,
  input: {
    restaurantId: string
    itemId: string
    file: { type: string; size: number }
    body: Blob
  },
): Promise<MenuImageOutcome> {
  const precheck = precheckMenuImage(input.file)
  if (precheck !== null) {
    return { ok: false, failure: { stage: 'upload', message: precheck.message } }
  }
  const mimeType = input.file.type as MenuImageMimeType
  const path = buildMenuImagePath({
    restaurantId: input.restaurantId,
    itemId: input.itemId,
    mimeType,
  })

  const uploaded = await storage.storage.from(MENU_IMAGES_BUCKET).upload(path, input.body, {
    contentType: mimeType,
  })
  if (uploaded.error !== null) {
    return { ok: false, failure: { stage: 'upload', message: uploaded.error.message } }
  }

  const recorded = await storage.setImagePath(input.itemId, path)
  if (!recorded.ok) {
    return {
      ok: false,
      failure: { stage: 'record', message: recorded.message ?? 'Recording failed.' },
    }
  }

  if (recorded.previousPath !== null) {
    // Best-effort delete of the superseded object (§4): on failure the item
    // is still correct and the old object is already unreadable (the select
    // policy tracks the reference, not the bytes) — the accepted residual,
    // never an error shown to the user.
    await storage.storage.from(MENU_IMAGES_BUCKET).remove([recorded.previousPath])
  }
  return { ok: true, path }
}

/**
 * Remove (contract §4): clear the reference, then delete the returned
 * previous object. A no-op clear resolves previousPath null — nothing to
 * delete.
 */
export async function removeMenuImage(
  storage: MenuImageStorage,
  itemId: string,
): Promise<MenuImageOutcome> {
  const recorded = await storage.setImagePath(itemId, null)
  if (!recorded.ok) {
    return {
      ok: false,
      failure: { stage: 'record', message: recorded.message ?? 'Recording failed.' },
    }
  }
  if (recorded.previousPath !== null) {
    // Same best-effort residual as uploadMenuImage.
    await storage.storage.from(MENU_IMAGES_BUCKET).remove([recorded.previousPath])
  }
  return { ok: true, path: '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Display: signed URLs (§4) — short TTL, cached in memory for the session
// ─────────────────────────────────────────────────────────────────────────────

/** Signing TTL in seconds (≈ 10 minutes, contract §4). */
export const MENU_IMAGE_URL_TTL_SECONDS = 600

/** Refresh margin: re-sign slightly before expiry, never mid-render. */
const URL_REFRESH_MARGIN_MS = 60_000

interface SignedUrlEntry {
  url: string
  expiresAt: number
}

const signedUrlCache = new Map<string, SignedUrlEntry>()

/**
 * A signed URL for an item's image (≈ 10-minute TTL, cached for the session).
 * Signing is subject to the select policy: a stale path (no visible item
 * references the object) resolves to null rather than a URL.
 */
export async function getSignedImageUrl(
  storage: Pick<StorageClientLike, 'from'>,
  imagePath: string,
): Promise<string | null> {
  const cached = signedUrlCache.get(imagePath)
  const now = Date.now()
  if (cached !== undefined && cached.expiresAt - URL_REFRESH_MARGIN_MS > now) {
    return cached.url
  }
  const result = await storage
    .from(MENU_IMAGES_BUCKET)
    .createSignedUrl(imagePath, MENU_IMAGE_URL_TTL_SECONDS)
  if (result.error !== null || result.data?.signedUrl === undefined) {
    signedUrlCache.delete(imagePath)
    return null
  }
  signedUrlCache.set(imagePath, {
    url: result.data.signedUrl,
    expiresAt: now + MENU_IMAGE_URL_TTL_SECONDS * 1000,
  })
  return result.data.signedUrl
}

/** Test hook: the signed-URL cache is module state; suites reset it. */
export function resetSignedUrlCacheForTests(): void {
  signedUrlCache.clear()
}
