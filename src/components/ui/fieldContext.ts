import { createContext, useContext } from 'react'
import styles from './Field.module.css'

/**
 * Field's shared wiring (spec 022 T005): split from Field.tsx so that file
 * exports only components (react-refresh/only-export-components).
 */

export type FieldWiring = {
  /** The id the Field's label points at — controls adopt it unless they pass their own. */
  fieldId?: string
  /** The aria-describedby value (hint + error slots). */
  describedBy?: string
}

export const FieldWiringContext = createContext<FieldWiring>({})

/** The ids a Field hands its control through the render prop. */
export type FieldRenderIds = {
  inputId: string
  hintId: string
  errorId: string
  describedBy: string | undefined
}

/** Read the enclosing Field's wiring (empty object without one). */
export function useFieldWiring(): FieldWiring {
  return useContext(FieldWiringContext)
}

/** The describedby value only (undefined outside a Field). */
export function useFieldDescribedBy(): string | undefined {
  return useContext(FieldWiringContext).describedBy
}

/** Class names a matching control uses to align with Field styling
 *  (`invalid` = the aria-invalid boolean the control received). */
export function fieldControlClass(invalid?: boolean): string {
  return invalid ? `${styles.control} ${styles.controlInvalid}` : styles.control
}
