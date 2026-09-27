import { useId } from 'react'
import { FieldWiringContext, type FieldRenderIds } from './fieldContext'
import styles from './Field.module.css'

/**
 * Field (spec 022 FR-04/T005): the one form-control wrapper. Owns the a11y
 * wiring forms always re-invent: label association, required marker, hint,
 * and an announced error slot (`role="alert"`). Errors attach to the field
 * (UX rule: form errors attach to fields and are announced — never a
 * detached toast).
 *
 * The wiring reaches controls two ways:
 *   1. Render prop: `{(ids) => <input id={ids.inputId} />}`
 *   2. Context: `<Input/>`/`<Textarea/>` adopt the Field's id and
 *      aria-describedby automatically via `useFieldWiring()`
 *      (the context lives in fieldContext.ts).
 */

export type FieldProps = {
  label: string
  /** Visual required marker on the label (the control keeps aria-required). */
  required?: boolean
  /** Help text under the label, above the error. */
  hint?: string
  /** The verbatim refusal/problem message; announced + invalid styling hook. */
  error?: string
  /** Link an existing control by id; omit when using the render prop. */
  forId?: string
  children?: React.ReactNode | ((ids: FieldRenderIds) => React.ReactNode)
}

export function Field({ label, required, hint, error, forId, children }: FieldProps) {
  const generated = useId()
  const inputId = forId ?? generated
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <FieldWiringContext.Provider value={{ fieldId: inputId, describedBy }}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
        {typeof children === 'function'
          ? children({ inputId, hintId, errorId, describedBy })
          : children}
        {error && (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </FieldWiringContext.Provider>
  )
}
