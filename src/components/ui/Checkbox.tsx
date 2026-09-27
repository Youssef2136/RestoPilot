import { useId } from 'react'
import { fieldControlClass, useFieldWiring } from './fieldContext'
import styles from './Field.module.css'
import checkbox from './Checkbox.module.css'

/**
 * Checkbox / RadioGroup (spec 022 FR-04/T005): choice controls with native
 * inputs — keyboard operability and screen-reader semantics come free;
 * the module styles the visible box/ring only (never `appearance: none`
 * without a drawn state — checked states use the brand role).
 */

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  invalid?: boolean
}

export function Checkbox({ label, invalid, className, id, ...rest }: CheckboxProps) {
  const generated = useId()
  const { fieldId, describedBy } = useFieldWiring()
  const inputId = id ?? generated ?? fieldId
  return (
    <div className={[checkbox.row, className].filter(Boolean).join(' ')}>
      <input
        id={inputId}
        type="checkbox"
        className={[checkbox.box, fieldControlClass(invalid), styles.checkboxInput]
          .filter(Boolean)
          .join(' ')}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      <label htmlFor={inputId} className={checkbox.label}>
        {label}
      </label>
    </div>
  )
}

export type RadioOption = { value: string; label: string; disabled?: boolean }

export type RadioGroupProps = {
  /** The group's accessible name (rendered as a fieldset legend). */
  legend: string
  name: string
  value: string
  onChange: (value: string) => void
  options: RadioOption[]
  invalid?: boolean
}

export function RadioGroup({ legend, name, value, onChange, options, invalid }: RadioGroupProps) {
  const { describedBy } = useFieldWiring()
  return (
    <fieldset
      className={checkbox.fieldset}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    >
      <legend className={checkbox.legend}>{legend}</legend>
      <div className={checkbox.stack}>
        {options.map((option) => {
          const optionId = `${name}-${option.value}`
          return (
            <div key={option.value} className={checkbox.row}>
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                disabled={option.disabled}
                className={[checkbox.box, fieldControlClass(invalid)].filter(Boolean).join(' ')}
              />
              <label htmlFor={optionId} className={checkbox.label}>
                {option.label}
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
