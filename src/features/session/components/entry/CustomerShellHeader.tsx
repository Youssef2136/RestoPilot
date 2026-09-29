import styles from './entry.module.css'

/**
 * The customer entry's identity lead (spec 024 FR-04, Visual Requirements):
 * the restaurant's name as the h1 (E2E-frozen — "heading order preserved:
 * h1 = restaurant name on entry") with the brand_description as the lead
 * paragraph. Typographic-only brand presentation: get_public_restaurant
 * exposes no imagery, and inventing logos is prohibited (Clarification Q5).
 */
export function CustomerShellHeader({
  name,
  brandDescription,
}: {
  name: string
  brandDescription: string | null
}) {
  return (
    <header className={styles.identity}>
      <h1>{name}</h1>
      {brandDescription ? <p className={styles.brandLine}>{brandDescription}</p> : null}
    </header>
  )
}
