import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import { getSignedImageUrl } from './menuImages'

/**
 * One item's signed display URL (spec 027 T003): the thumbnail seam over the
 * existing `getSignedImageUrl` helper — the ONLY storage call this phase adds,
 * and only for DISPLAY (the upload/replace/remove orchestration stays in
 * `menuImages.ts` untouched). The same never-broken rule as the editor field:
 * a stale path (the object no longer referenced by any visible item) resolves
 * to null and the row renders the empty-state placeholder — never a broken
 * `<img>`.
 *
 * The storage client here is the publishable-key client; signing is subject
 * to the select policy server-side (menuImages.ts header).
 */
export function useItemImage(imagePath: string | null): {
  signedUrl: string | null
  resolved: boolean
} {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setResolved(false)
    if (imagePath === null || imagePath === '') {
      setSignedUrl(null)
      setResolved(true)
      return
    }
    void (async () => {
      const url = await getSignedImageUrl(
        getSupabaseClient().storage as unknown as Parameters<typeof getSignedImageUrl>[0],
        imagePath,
      )
      if (!cancelled) {
        setSignedUrl(url)
        setResolved(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [imagePath])

  return { signedUrl, resolved }
}
