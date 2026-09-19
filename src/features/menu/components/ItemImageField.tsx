import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../../../lib/supabase'
import {
  MENU_IMAGE_MAX_BYTES,
  MENU_IMAGE_MIME_TYPES,
  getSignedImageUrl,
  objectPathOf,
  removeMenuImage,
  uploadMenuImage,
  type MenuImageStorage,
} from '../menuImages'
import { menuClient } from '../menuClient'
import { useMenuInvalidation } from '../useMenu'

/**
 * One item's image field (contracts/menu-images.md §4; spec 005 US5,
 * FR-021, FR-022): add, replace, and remove through the upload → record →
 * delete-old ordering, with the failing bound NAMED on rejection (type or
 * size) and the item never showing a broken reference.
 *
 * "Never broken" is structural here: the field renders only from a SIGNED
 * URL it has actually resolved — a stale path (no visible item references
 * the object any more) resolves to null and the field shows the empty state,
 * never a broken <img>. Signing is itself policy-checked server-side.
 *
 * The RPC remains the boundary (Constitution IV); every accepted change
 * invalidates the whole menu surface (the branch projections carry the path).
 */

/** The MenuImageStorage seam over the real client and menuClient. */
const imageStorage: MenuImageStorage = {
  storage: getSupabaseClient().storage as unknown as MenuImageStorage['storage'],
  setImagePath: async (itemId, path) => {
    const result = await menuClient.setItemImage(itemId, path)
    if (result.ok) {
      return { ok: true, previousPath: result.data }
    }
    return { ok: false, message: result.message, previousPath: null }
  },
}

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

export function ItemImageField({
  restaurantId,
  imagePath,
  itemId,
}: {
  restaurantId: string
  imagePath: string | null
  itemId: string
}) {
  const invalidate = useMenuInvalidation()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)

  const path = objectPathOf(imagePath)

  // Resolve the signed URL for display; a stale path resolves to null and the
  // field renders the empty state — never a broken reference (FR-021).
  useEffect(() => {
    let cancelled = false
    setResolved(false)
    if (path === null) {
      setSignedUrl(null)
      setResolved(true)
      return
    }
    void (async () => {
      const url = await getSignedImageUrl(imageStorage.storage, path)
      if (!cancelled) {
        setSignedUrl(url)
        setResolved(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path])

  async function afterChange(message: string) {
    invalidate(restaurantId)
    setFeedback({ tone: 'success', message })
    // Re-resolve on the next render against the new path.
    setResolved(false)
  }

  async function handleFile(file: File) {
    setBusy(true)
    setFeedback(null)
    const outcome = await uploadMenuImage(imageStorage, {
      restaurantId,
      itemId,
      file: { type: file.type, size: file.size },
      body: file,
    })
    setBusy(false)
    if (!outcome.ok) {
      // The failing bound, named (type or size), or the server's own message.
      setFeedback({ tone: 'error', message: outcome.failure.message })
      return
    }
    await afterChange('Image saved.')
  }

  async function remove() {
    setBusy(true)
    setFeedback(null)
    const outcome = await removeMenuImage(imageStorage, itemId)
    setBusy(false)
    if (!outcome.ok) {
      setFeedback({ tone: 'error', message: outcome.failure.message })
      return
    }
    await afterChange('Image removed.')
  }

  return (
    <section aria-label={`Image for item ${itemId}`}>
      <h4>Image</h4>
      {resolved && path !== null && signedUrl !== null && <img src={signedUrl} alt="Item image" />}
      {path !== null && signedUrl === null && <p>An image is set but cannot be displayed.</p>}
      <div>
        <label htmlFor={`item-image-${itemId}`}>
          Add or replace (JPEG, PNG, or WebP; up to 5 MB)
        </label>
        <input
          id={`item-image-${itemId}`}
          type="file"
          accept={MENU_IMAGE_MIME_TYPES.join(',')}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file !== undefined) {
              void handleFile(file)
            }
          }}
        />
        <p>{`Up to ${Math.round(MENU_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`}</p>
      </div>
      {path !== null && (
        <button type="button" onClick={() => void remove()} disabled={busy}>
          {busy ? 'Working…' : 'Remove image'}
        </button>
      )}
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </section>
  )
}
