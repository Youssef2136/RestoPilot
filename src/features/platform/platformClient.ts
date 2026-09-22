/*
 * Phase 13 — the platform client (spec 014 T006; contracts/
 * database-functions.md §1–§3).
 *
 * Four reads/writes, all rendered verbatim: `get_platform_overview` (the
 * console's single read), `get_my_subscription` (the tenant banner payload),
 * `set_subscription_dates` (activate/change), and
 * `set_restaurant_platform_disabled` (the kill-switch). The server derives
 * the lifecycle state (Constitution III) — this module shapes parameters,
 * maps refusals, and validates payload shape. Nothing else.
 *
 * Fail-closed payload discipline (the audit/staffOps convention): a payload
 * missing its contract keys is malformed, never rendered.
 */

import { getSupabaseClient } from '../../lib/supabase'

export type SubscriptionState = 'never_activated' | 'active' | 'nearing_expiration' | 'expired'

export interface PlatformRestaurantRow {
  restaurant_id: string
  name: string
  slug: string
  start_date: string | null
  end_date: string | null
  state: SubscriptionState
  platform_disabled: boolean
  platform_disabled_reason: string | null
  branch_count: number
  staff_count: number
  session_count: number
  round_count: number
}

export interface MySubscription {
  restaurant_id: string
  start_date: string | null
  end_date: string | null
  state: SubscriptionState
  platform_disabled: boolean
  platform_disabled_reason: string | null
}

export class PlatformPayloadError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'PlatformPayloadError'
    this.code = code
  }
}

const STATES: ReadonlySet<string> = new Set([
  'never_activated',
  'active',
  'nearing_expiration',
  'expired',
])

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseOverviewRow(raw: unknown): PlatformRestaurantRow {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new PlatformPayloadError('malformed', 'The platform payload was malformed.')
  }
  const r = raw as Record<string, unknown>
  if (
    typeof r.restaurant_id !== 'string' ||
    typeof r.name !== 'string' ||
    typeof r.slug !== 'string' ||
    typeof r.state !== 'string' ||
    !STATES.has(r.state) ||
    typeof r.platform_disabled !== 'boolean' ||
    !isFiniteNumber(r.branch_count) ||
    !isFiniteNumber(r.staff_count) ||
    !isFiniteNumber(r.session_count) ||
    !isFiniteNumber(r.round_count)
  ) {
    throw new PlatformPayloadError('malformed', 'The platform payload was malformed.')
  }
  return {
    restaurant_id: r.restaurant_id,
    name: r.name,
    slug: r.slug,
    start_date: typeof r.start_date === 'string' ? r.start_date : null,
    end_date: typeof r.end_date === 'string' ? r.end_date : null,
    state: r.state as SubscriptionState,
    platform_disabled: r.platform_disabled,
    platform_disabled_reason:
      typeof r.platform_disabled_reason === 'string' ? r.platform_disabled_reason : null,
    branch_count: r.branch_count,
    staff_count: r.staff_count,
    session_count: r.session_count,
    round_count: r.round_count,
  }
}

export async function getPlatformOverview(): Promise<PlatformRestaurantRow[]> {
  const { data, error } = await getSupabaseClient().rpc('get_platform_overview')
  if (error) {
    throw new PlatformPayloadError(error.code ?? 'unexpected', error.message)
  }
  if (!Array.isArray(data)) {
    throw new PlatformPayloadError('malformed', 'The platform payload was malformed.')
  }
  return (data as unknown[]).map(parseOverviewRow)
}

export async function getMySubscription(): Promise<MySubscription | null> {
  const { data, error } = await getSupabaseClient().rpc('get_my_subscription')
  if (error) {
    throw new PlatformPayloadError(error.code ?? 'unexpected', error.message)
  }
  if (data === null || data === undefined) {
    return null
  }
  const parsed = parseOverviewRow({
    restaurant_id: (data as Record<string, unknown>).restaurant_id,
    name: '',
    slug: '',
    start_date: (data as Record<string, unknown>).start_date,
    end_date: (data as Record<string, unknown>).end_date,
    state: (data as Record<string, unknown>).state,
    platform_disabled: (data as Record<string, unknown>).platform_disabled,
    platform_disabled_reason: (data as Record<string, unknown>).platform_disabled_reason,
    branch_count: 0,
    staff_count: 0,
    session_count: 0,
    round_count: 0,
  })
  return {
    restaurant_id: parsed.restaurant_id,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    state: parsed.state,
    platform_disabled: parsed.platform_disabled,
    platform_disabled_reason: parsed.platform_disabled_reason,
  }
}

export async function setSubscriptionDates(input: {
  restaurantId: string
  startDate: string
  endDate: string
}): Promise<{ state: SubscriptionState }> {
  const { data, error } = await getSupabaseClient().rpc('set_subscription_dates', {
    p_restaurant_id: input.restaurantId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
  })
  if (error) {
    throw new PlatformPayloadError(error.code ?? 'unexpected', error.message)
  }
  const state = (data as Record<string, unknown> | null)?.state
  if (typeof state !== 'string' || !STATES.has(state)) {
    throw new PlatformPayloadError('malformed', 'The subscription payload was malformed.')
  }
  return { state: state as SubscriptionState }
}

export async function setRestaurantPlatformDisabled(input: {
  restaurantId: string
  disabled: boolean
  reason: string
}): Promise<{ changed: boolean }> {
  const { data, error } = await getSupabaseClient().rpc('set_restaurant_platform_disabled', {
    p_restaurant_id: input.restaurantId,
    p_disabled: input.disabled,
    p_reason: input.reason,
  })
  if (error) {
    throw new PlatformPayloadError(error.code ?? 'unexpected', error.message)
  }
  const changed = (data as Record<string, unknown> | null)?.changed
  if (typeof changed !== 'boolean') {
    throw new PlatformPayloadError('malformed', 'The disable payload was malformed.')
  }
  return { changed }
}
