import styles from './Skeleton.module.css'

/**
 * Skeleton (spec 037 FR-02/T001; clarified threshold ~300 ms): the loading
 * placeholder family. Sizing contract: the caller sizes the skeleton to match
 * the content it replaces (explicit width/height, or text lines whose
 * line-height comes from the type scale) so the swap to content causes no
 * layout shift at any breakpoint.
 *
 * Purely decorative — `aria-hidden` (a skeleton is not an announcement);
 * surfaces that must announce loading render one polite `role="status"` line
 * beside it (announce only when it matters — UX rule). Shimmer is CSS-only
 * and respects `prefers-reduced-motion` (falls back to a static tint).
 */

export type SkeletonVariant = 'text' | 'block'

export type SkeletonProps = {
  variant?: SkeletonVariant
  /** text: how many placeholder lines (heights from the type scale). */
  lines?: number
  /** Explicit sizing when the content's box is known (any CSS width/height). */
  width?: string
  height?: string
  /** Stable hook for tests/data-state consumers (state matrix rows). */
  testId?: string
  className?: string
}

export function Skeleton({
  variant = 'block',
  lines = 1,
  width,
  height,
  testId,
  className,
}: SkeletonProps) {
  if (variant === 'text') {
    return (
      <span
        aria-hidden="true"
        className={className ?? undefined}
        data-skeleton="text"
        data-testid={testId}
      >
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={styles.text}
            style={i === lines - 1 && width ? { width } : undefined}
          />
        ))}
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${styles.block} ${className ?? ''}`}
      style={{ width, height }}
      data-skeleton="block"
      data-testid={testId}
    />
  )
}
