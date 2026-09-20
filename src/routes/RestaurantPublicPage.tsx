import { useParams } from 'react-router'
import { RestaurantEntry } from '../features/session/components/RestaurantEntry'

/**
 * The public restaurant page (spec 007 FR-001): `/r/:slug` — the customer
 * entry flow. Unknown slugs render the entry component's not-found state.
 * No dashboard chrome, no auth context — the public surface.
 */
export function RestaurantPublicPage() {
  const { slug } = useParams<{ slug: string }>()

  if (slug === undefined || slug === '') {
    return (
      <section>
        <h1>Restaurant not found</h1>
        <p role="alert">We could not find this restaurant.</p>
      </section>
    )
  }

  return <RestaurantEntry slug={slug} />
}
