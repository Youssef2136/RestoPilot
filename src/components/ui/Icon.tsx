/**
 * Icon (spec 022 FR-04, Q4; Master Plan §5.1): the internal icon system.
 * Authored inline SVGs at one consistent stroke (1.75) and weight, sized by
 * the token scale, tinted by currentColor — no icon package (FA-10).
 *
 * Decorative by default (`aria-hidden`) — the accessible name belongs to the
 * control that carries the icon (`IconButton` labels itself). A standalone
 * informative icon passes `label` to render role="img".
 *
 * Glyphs (first consumers): dashboard (03 shell), sessions (03), rounds/
 * receipt (03), kitchen/clipboard (03), chart (13), shield/audit (03),
 * plus (06), minus (05), x/close (03), chevron-down (03 select), chevron-
 * left/right (08 pagination), check (05 states), alert-triangle (05 toasts),
 * info (05), user (03), users (06), settings (03), logout (03), search (13),
 * external (14).
 */

export type IconName =
  | 'dashboard'
  | 'sessions'
  | 'receipt'
  | 'kitchen'
  | 'chart'
  | 'shield'
  | 'plus'
  | 'minus'
  | 'x'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'alert-triangle'
  | 'info'
  | 'user'
  | 'users'
  | 'settings'
  | 'logout'
  | 'search'
  | 'external'

const GLYPHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3.75" y="3.75" width="7" height="7" rx="1.5" />
      <rect x="13.25" y="3.75" width="7" height="7" rx="1.5" />
      <rect x="3.75" y="13.25" width="7" height="7" rx="1.5" />
      <rect x="13.25" y="13.25" width="7" height="7" rx="1.5" />
    </>
  ),
  sessions: (
    <>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2" />
      <path d="M3.75 9.25h16.5" />
      <circle cx="8.25" cy="14.5" r="1.25" />
      <circle cx="12.75" cy="14.5" r="1.25" />
    </>
  ),
  receipt: (
    <>
      <path d="M5.75 3.75h12.5v16.5l-2.5-1.5-2.5 1.5-2.5-1.5-2.5 1.5-2.5-1.5z" />
      <path d="M9 8.5h6M9 12h6" />
    </>
  ),
  kitchen: (
    <>
      <rect x="4.75" y="3.75" width="14.5" height="16.5" rx="2" />
      <path d="M4.75 9.75h14.5M9.75 9.75v10.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4.75 20.25V14M10.25 20.25V9M15.75 20.25V11.5M21.25 20.25V5.5" />
      <path d="M3.75 20.25h18.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.75 5.25 6.5v5.25c0 4.5 3 7.5 6.75 9 3.75-1.5 6.75-4.5 6.75-9V6.5z" />
      <path d="m9.25 11.75 2 2 3.75-4" />
    </>
  ),
  plus: <path d="M12 5.75v12.5M5.75 12h12.5" />,
  minus: <path d="M5.75 12h12.5" />,
  x: <path d="m6.25 6.25 11.5 11.5M17.75 6.25 6.25 17.75" />,
  'chevron-down': <path d="m6.5 9.75 5.5 5.5 5.5-5.5" />,
  'chevron-left': <path d="m14.25 6.5-5.5 5.5 5.5 5.5" />,
  'chevron-right': <path d="m9.75 6.5 5.5 5.5-5.5 5.5" />,
  check: <path d="m5.5 12.5 4.5 4.5 8.5-9.5" />,
  'alert-triangle': (
    <>
      <path d="M12 4.25 3.75 18.5h16.5z" />
      <path d="M12 10v3.75" />
      <circle cx="12" cy="16.25" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.25" r="3.5" />
      <path d="M5.25 19.75c1.25-3.25 3.75-4.75 6.75-4.75s5.5 1.5 6.75 4.75" />
    </>
  ),
  users: (
    <>
      <circle cx="9.25" cy="8.75" r="3" />
      <path d="M3.75 19c1-2.75 3-4 5.5-4s4.5 1.25 5.5 4" />
      <path d="M15.5 6.25a3 3 0 0 1 0 5.5M17 15.4c1.75.55 2.9 1.7 3.5 3.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.25v2M12 17.75v2M4.25 12h2M17.75 12h2M6.5 6.5l1.4 1.4M16.1 16.1l1.4 1.4M17.5 6.5l-1.4 1.4M7.9 16.1l-1.4 1.4" />
    </>
  ),
  logout: (
    <>
      <path d="M14.25 4.75H7.75a2 2 0 0 0-2 2v10.5a2 2 0 0 0 2 2h6.5" />
      <path d="M11.75 12h8.5M17.25 9l3 3-3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="5.25" />
      <path d="m15.25 15.25 5 5" />
    </>
  ),
  external: (
    <>
      <path d="M10.5 5.75h-3a2 2 0 0 0-2 2v9.5a2 2 0 0 0 2 2h9.5a2 2 0 0 0 2-2v-3" />
      <path d="M14.25 4.75h5v5M19.25 4.75 12 12" />
    </>
  ),
}

export type IconProps = {
  name: IconName
  /** Pixel size of the square viewBox; defaults to 20 (the control glyph). */
  size?: number
  /** Accessible name for standalone, informative icons. */
  label?: string
  className?: string
}

export function Icon({ name, size = 20, label, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      className={className}
    >
      {GLYPHS[name]}
    </svg>
  )
}
