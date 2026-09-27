import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { type RouteMeta, routeMetaFor } from './routes'

/**
 * Route metadata application (spec 021 FR-02 / US2): mounted once above the
 * router's <Routes>, applies the registry's document title and meta
 * description on every navigation. Pages never set titles themselves.
 *
 * `extraRoutes` extends the lookup universe for DEV-only routes (the
 * gallery) — passed from router.tsx where the DEV gate lives.
 *
 * Unknown paths keep the previous title until the 404 view takes over — the
 * 404's own copy is the recovery affordance there, and the registry has no
 * entry for a path that does not exist.
 */
export function RouteTitles({ extraRoutes = [] }: { extraRoutes?: RouteMeta[] }) {
  const { pathname } = useLocation()

  useEffect(() => {
    const meta = routeMetaFor(pathname, extraRoutes)
    if (!meta) return

    document.title = meta.title

    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'description'
      document.head.appendChild(tag)
    }
    tag.content = meta.description
  }, [pathname, extraRoutes])

  return null
}
