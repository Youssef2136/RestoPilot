import styles from './Alert.module.css'

/**
 * FormErrorSummary (spec 022 FR-04/T005): the top-of-form error block for
 * multi-field refusals. Announced once via role="alert" (the per-field
 * errors stay attached to their fields — the summary is orientation, not a
 * replacement). Items render as plain text: jump links would be touch
 * targets below the 24px floor inside a dense list (axe target-size), and
 * the fields' own inline errors are the actionable path. The server's
 * message renders verbatim (FA-7).
 */

export type FormError = {
  /** The failing control's id (for the focus link). */
  fieldId: string
  /** The verbatim message (server text or the field's own rule). */
  message: string
}

export function FormErrorSummary({
  heading = 'Fix the following:',
  errors,
}: {
  heading?: string
  errors: FormError[]
}) {
  if (errors.length === 0) return null
  return (
    <div className={`${styles.alert} ${styles.danger}`} role="alert">
      <p className={styles.title}>{heading}</p>
      <ul className={styles.list}>
        {errors.map((error) => (
          <li key={error.fieldId}>{error.message}</li>
        ))}
      </ul>
    </div>
  )
}
