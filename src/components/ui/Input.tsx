import { fieldControlClass, useFieldWiring } from './fieldContext'
import styles from './Field.module.css'

/**
 * Input / Textarea / Select / NumberInput (spec 022 FR-04/T005): the text
 * controls. Inside a Field they adopt its id (label association) and its
 * aria-describedby wiring automatically; a control may still pass its own
 * `id` (an explicit id wins — Field's `forId` must then point at it).
 * Invalid styling is driven by the standard `aria-invalid` props — verbatim
 * server messages render in Field's error slot (FA-7).
 */

type ControlBase = {
  /** Marks the control invalid (announced through Field's error slot). */
  invalid?: boolean
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & ControlBase

export function Input({ invalid, className, id, ...rest }: InputProps) {
  const { fieldId, describedBy } = useFieldWiring()
  return (
    <input
      id={id ?? fieldId}
      className={[fieldControlClass(invalid), className].filter(Boolean).join(' ')}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & ControlBase

export function Textarea({ invalid, className, id, rows = 3, ...rest }: TextareaProps) {
  const { fieldId, describedBy } = useFieldWiring()
  return (
    <textarea
      id={id ?? fieldId}
      rows={rows}
      className={[fieldControlClass(invalid), className].filter(Boolean).join(' ')}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & ControlBase

export function Select({ invalid, className, id, children, ...rest }: SelectProps) {
  const { fieldId, describedBy } = useFieldWiring()
  return (
    <select
      id={id ?? fieldId}
      className={[fieldControlClass(invalid), styles.select, className].filter(Boolean).join(' ')}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  )
}

/**
 * NumberInput: `inputMode="decimal"` + pattern feedback stays the app's
 * money-entry convention — NO numeric parsing here (money is exact text
 * through the existing formatters; research.md R1).
 */
export type NumberInputProps = InputProps

export function NumberInput(props: NumberInputProps) {
  return <Input type="text" inputMode="decimal" {...props} />
}
