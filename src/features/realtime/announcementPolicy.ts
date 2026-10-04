/*
 * Phase 12 — the ONE announcement policy (specs/032 FR-07, D2; plan.md;
 * checklists/realtime-fidelity.md F3/F4). Every passive announcement the
 * product makes routes through this module: the event class decides the
 * SURFACE (cue live region, connection banner, toast, or silence), the
 * POLITENESS, and the COPY — so two surfaces can never disagree about how
 * one event is told, and one event can never announce twice (the dedupe
 * guard, F4).
 *
 * Toasts are deliberately OUT of the passive map (D2): the toast host is
 * for user-initiated outcomes (spec 023); routing a background event there
 * as well would double-announce it against the live regions.
 *
 * The copy constants are the SUITES' pinned strings moved here byte-
 * identically (shell.test, cashier.operations, realtime.test, platform
 * banner tests) — the components render from these constants, so the pins
 * hold without edits. The mapping itself is pure and unit-testable without
 * a DOM (the house node-environment method).
 */

/** The passive event classes the product announces (or silences). */
export type AnnouncementClass =
  'round-arrival' | 'connection-loss' | 'connection-recovered' | 'refetch' | 'subscription-state'

/** Where an announcement may land. 'toast' is never returned (D2). */
export type AnnouncementSurface = 'cue-live-region' | 'connection-banner' | 'toast' | 'silent'

export interface AnnouncementDecision {
  surface: AnnouncementSurface
  /** 'polite' = a polite live region/banner; 'none' = silent invalidation. */
  politeness: 'polite' | 'none'
  /** The pinned copy for the class (empty for silent). */
  copy: string
}

/* ── the pinned copy (moved here byte-identically; F3) ──────────────────── */

/** The cue's fixed line — no payload fields may join it (FR-02, F1). */
export const CUE_ARRIVED_COPY = 'A new order arrived.'
/** The staff boards' transport-loss banner (each board shows its own). */
export const BOARD_RECONNECTING_COPY =
  'The live connection dropped — reconnecting. Showing the last known board.'
/** The shell's transport-loss line. */
export const SHELL_RECONNECTING_COPY = 'Reconnecting to live updates…'
/** The shell's navigator-offline line. */
export const SHELL_OFFLINE_COPY = "You're offline — changes can't reach the server right now."
/** The shell's transient post-recovery confirmation (FR-04). */
export const RECOVERED_COPY = 'Back online — live updates restored.'
/** The stale-data posture line (fetch failed, last-known data shown). */
export const STALE_RETRY_COPY = 'The last refresh failed — showing the last known board.'
/** The retry affordance label (shell + boards). */
export const RETRY_NOW_COPY = 'Retry now'

/* ── the policy map ──────────────────────────────────────────────────────── */

function decisionFor(cls: AnnouncementClass): AnnouncementDecision {
  switch (cls) {
    case 'round-arrival':
      // The cue's own live region (role="status") — the arrival surface.
      return { surface: 'cue-live-region', politeness: 'polite', copy: CUE_ARRIVED_COPY }
    case 'connection-loss':
      // The connection banner(s) — board-local and/or the shell's.
      return { surface: 'connection-banner', politeness: 'polite', copy: SHELL_RECONNECTING_COPY }
    case 'connection-recovered':
      // The transient recovered confirmation (FR-04's "data is current").
      return { surface: 'connection-banner', politeness: 'polite', copy: RECOVERED_COPY }
    case 'refetch':
      // Silent invalidation — the refetched read IS the announcement (F2).
      return { surface: 'silent', politeness: 'none', copy: '' }
    case 'subscription-state':
      // The subscription banner + detail panel (FR-05/FR-06).
      return { surface: 'connection-banner', politeness: 'polite', copy: '' }
  }
}

/* ── the dedupe guard (F4: one event ⇒ one announcement) ────────────────── */

const DEDUPE_WINDOW_MS = 1_000
const lastAnnounced = new Map<string, number>()

/**
 * Whether an announcement of `key` may fire now: the same key inside the
 * dedupe window is a duplicate (coalescing, retries, and multi-binding
 * fan-out must not stack). Pure time input for tests; stateful only in the
 * module map.
 */
export function shouldAnnounce(key: string, now: number = Date.now()): boolean {
  const previous = lastAnnounced.get(key)
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) {
    return false
  }
  lastAnnounced.set(key, now)
  return true
}

/** Test/admin escape: forget the dedupe history. */
export function resetAnnouncements(): void {
  lastAnnounced.clear()
}

/**
 * The one entry point: decide how an event class is announced. When a
 * `dedupeKey` is given, a duplicate inside the window collapses to silent
 * (the surface stays out of the DOM — the caller renders nothing new).
 */
export function announce(
  cls: AnnouncementClass,
  dedupeKey?: string,
  now: number = Date.now(),
): AnnouncementDecision {
  const decision = decisionFor(cls)
  if (
    dedupeKey !== undefined &&
    decision.politeness === 'polite' &&
    !shouldAnnounce(dedupeKey, now)
  ) {
    return { surface: 'silent', politeness: 'none', copy: '' }
  }
  return decision
}
