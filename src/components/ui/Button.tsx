import { Icon, type IconName } from './Icon'
import styles from './Button.module.css'

/**
 * Button (spec 022 FR-04; Master Plan §5.3 Actions; first consumer: Phase 03
 * shell). Variants map to the semantic palette: primary = brand action,
 * secondary = raised surface, ghost = quiet inline action, danger =
 * destructive (Phase 03+ wraps it in the confirm Dialog per the UX rule).
 *
 * States: default/hover/active per variant, focus-visible ring, disabled,
 * loading (`aria-busy`, control disabled, leading spinner, label kept for
 * AT). Renders a native `<button type>`; `type` defaults to "button" so a
 * stray click inside a form never submits it — pass `type="submit"` where a
 * form's submit is meant (the app's forms own their onSubmit contracts).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  )
}

export type IconButtonProps = Omit<ButtonProps, 'children'> & {
  icon: IconName
  /** The accessible name — an IconButton never ships unlabeled. */
  label: string
}

export function IconButton({ icon, label, size = 'md', ...rest }: IconButtonProps) {
  return (
    <Button size={size} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 20} />
    </Button>
  )
}
