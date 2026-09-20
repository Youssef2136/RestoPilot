import { getSupabaseClient } from '../../lib/supabase'
import { parseBranchMenu, type BranchMenu } from '../menu/menuClient'

/**
 * Session client module (contracts/session-client.md §1–§2) — the typed
 * wrapper over the seven session RPCs and the ONLY import path for them in
 * application code. No authorization logic, no optimistic writes: every
 * wrapper performs one RPC round trip and reports the server's own outcome
 * (the enforced boundary is the RPC surface — Constitution IV).
 *
 * `42501` becomes the generic denial, `P0001` the server's human-written
 * message verbatim (the contract's customer-facing vocabulary), anything
 * else the retry fallback. Malformed payloads throw `SessionPayloadError`
 * so surfaces render a retry state instead of partial data.
 *
 * Token storage rules (§2): the raw token lives only in `localStorage` under
 * the documented key — written once on entry success, read for customer
 * reads, cleared on a refused recovery. It never travels in a URL after
 * entry, and the staff side never reads it.
 */

export type SessionErrorKind = 'denied' | 'validation' | 'retry'

export type SessionResult<T> =
  { ok: true; data: T } | { ok: false; kind: SessionErrorKind; message: string }

/** SQLSTATE `42501` ⇒ this generic denial (contract §1). */
export const SESSION_DENIED_MESSAGE =
  'Not permitted. Your account does not have permission to perform this action.'

/** Anything the RPCs never produce (e.g. a transient failure) ⇒ this retry. */
export const SESSION_RETRY_MESSAGE = 'The request could not be completed. Please try again.'

/** The single refusal for unknown, tampered, or closed sessions (FR-014). */
export const SESSION_UNAVAILABLE_MESSAGE = 'This session is no longer available.'

/** The documented `localStorage` key (contract §2). */
export const SESSION_TOKEN_KEY = 'restopilot.session-token'

/**
 * Map a PostgREST error to the module's contract. `P0001` surfaces the
 * server's message verbatim — the recovery rule depends on recognizing
 * SESSION_UNAVAILABLE_MESSAGE on customer routes.
 */
export function mapSessionError(error: { code?: string; message: string }): {
  kind: SessionErrorKind
  message: string
} {
  if (error.code === '42501') {
    return { kind: 'denied', message: SESSION_DENIED_MESSAGE }
  }
  if (error.code === 'P0001') {
    return { kind: 'validation', message: error.message }
  }
  return { kind: 'retry', message: SESSION_RETRY_MESSAGE }
}

export class SessionPayloadError extends Error {}

/* ── payload types ─────────────────────────────────────────────────────────── */

export interface PublicRestaurantBranch {
  id: string
  name: string
  /** The branch's ACTIVE tables only — the selectable entry options (FR-003). */
  tables: Array<{ id: string; label: string }>
}

export interface PublicRestaurantPayload {
  restaurant: { id: string; name: string; slug: string; brand_description: string | null }
  branches: PublicRestaurantBranch[]
}

export interface SessionSummary {
  id: string
  restaurant_id: string
  branch_id: string
  table_id: string
  type: string
  status: string
  opened_at: string
}

export interface SessionParticipantPayload {
  id: string
  display_name: string
  joined_at: string
}

export interface EntryPayload {
  session: SessionSummary
  token: string
  participant: SessionParticipantPayload
}

export interface SessionContextPayload {
  session: SessionSummary
  indicator: { restaurant_name: string; branch_name: string; table_label: string }
  participants: SessionParticipantPayload[]
}

export type SessionMenu = BranchMenu

export interface BranchOpenSessionsPayload {
  sessions: Array<{
    id: string
    table_id: string
    table_label: string
    opened_at: string
    participants: SessionParticipantPayload[]
  }>
}

export interface ClosePayload {
  closed: boolean
  closed_at: string
}

/* ── payload parsing ───────────────────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string') {
    throw new SessionPayloadError(`Expected a string at "${key}".`)
  }
  return value
}

function optionalString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new SessionPayloadError(`Expected a string or null at "${key}".`)
  }
  return value
}

function requireArray(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key]
  if (!Array.isArray(value)) {
    throw new SessionPayloadError(`Expected an array at "${key}".`)
  }
  return value
}

function parseSession(raw: unknown): SessionSummary {
  if (!isRecord(raw)) {
    throw new SessionPayloadError('Expected a session object.')
  }
  return {
    id: requireString(raw, 'id'),
    restaurant_id: requireString(raw, 'restaurant_id'),
    branch_id: requireString(raw, 'branch_id'),
    table_id: requireString(raw, 'table_id'),
    type: requireString(raw, 'type'),
    status: requireString(raw, 'status'),
    opened_at: requireString(raw, 'opened_at'),
  }
}

function parseParticipant(raw: unknown): SessionParticipantPayload {
  if (!isRecord(raw)) {
    throw new SessionPayloadError('Expected a participant object.')
  }
  return {
    id: requireString(raw, 'id'),
    display_name: requireString(raw, 'display_name'),
    joined_at: requireString(raw, 'joined_at'),
  }
}

export function parsePublicRestaurant(payload: unknown): PublicRestaurantPayload {
  if (!isRecord(payload)) {
    throw new SessionPayloadError('Expected a restaurant object.')
  }
  const restaurant = payload.restaurant
  if (!isRecord(restaurant)) {
    throw new SessionPayloadError('Expected a restaurant object at "restaurant".')
  }
  return {
    restaurant: {
      id: requireString(restaurant, 'id'),
      name: requireString(restaurant, 'name'),
      slug: requireString(restaurant, 'slug'),
      brand_description: optionalString(restaurant, 'brand_description'),
    },
    branches: requireArray(payload, 'branches').map((raw) => {
      if (!isRecord(raw)) {
        throw new SessionPayloadError('Expected a branch object.')
      }
      return {
        id: requireString(raw, 'id'),
        name: requireString(raw, 'name'),
        tables: requireArray(raw, 'tables').map((tableRaw) => {
          if (!isRecord(tableRaw)) {
            throw new SessionPayloadError('Expected a table object.')
          }
          return { id: requireString(tableRaw, 'id'), label: requireString(tableRaw, 'label') }
        }),
      }
    }),
  }
}

export function parseEntry(payload: unknown): EntryPayload {
  if (!isRecord(payload)) {
    throw new SessionPayloadError('Expected an entry object.')
  }
  return {
    session: parseSession(payload.session),
    token: requireString(payload, 'token'),
    participant: parseParticipant(payload.participant),
  }
}

export function parseSessionContext(payload: unknown): SessionContextPayload {
  if (!isRecord(payload)) {
    throw new SessionPayloadError('Expected a context object.')
  }
  const indicator = payload.indicator
  if (!isRecord(indicator)) {
    throw new SessionPayloadError('Expected an indicator object.')
  }
  return {
    session: parseSession(payload.session),
    indicator: {
      restaurant_name: requireString(indicator, 'restaurant_name'),
      branch_name: requireString(indicator, 'branch_name'),
      table_label: requireString(indicator, 'table_label'),
    },
    participants: requireArray(payload, 'participants').map(parseParticipant),
  }
}

function parseBranchOpenSessions(payload: unknown): BranchOpenSessionsPayload {
  if (!isRecord(payload)) {
    throw new SessionPayloadError('Expected a sessions object.')
  }
  return {
    sessions: requireArray(payload, 'sessions').map((raw) => {
      if (!isRecord(raw)) {
        throw new SessionPayloadError('Expected a session object.')
      }
      return {
        id: requireString(raw, 'id'),
        table_id: requireString(raw, 'table_id'),
        table_label: requireString(raw, 'table_label'),
        opened_at: requireString(raw, 'opened_at'),
        participants: requireArray(raw, 'participants').map(parseParticipant),
      }
    }),
  }
}

function parseClose(payload: unknown): ClosePayload {
  if (!isRecord(payload)) {
    throw new SessionPayloadError('Expected a close object.')
  }
  return {
    closed: payload.closed === true,
    closed_at: requireString(payload, 'closed_at'),
  }
}

/* ── token storage (contract §2) ───────────────────────────────────────────── */

export function storeSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

export function readSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

/* ── the wrappers ──────────────────────────────────────────────────────────── */

/** Awaits one row-returning RPC and normalizes it into the result shape. */
async function settle<T>(
  request: PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>,
): Promise<SessionResult<T>> {
  try {
    const { data, error } = await request
    if (error !== null) {
      return { ok: false, ...mapSessionError(error) }
    }
    if (data === null) {
      return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}

/** Alias kept for the contract's naming: the context read. */
export const getContext = getSessionContext

/** Alias kept for the contract's naming: the menu read. */
export const getMenu = getSessionMenu

export async function getPublicRestaurant(
  slug: string,
): Promise<SessionResult<PublicRestaurantPayload>> {
  const result = await settle<unknown>(
    getSupabaseClient().rpc('get_public_restaurant', { p_slug: slug }),
  )
  if (!result.ok) {
    return result
  }
  try {
    return { ok: true, data: parsePublicRestaurant(result.data) }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}

export async function enterSession(input: {
  restaurantId: string
  branchId: string
  tableId: string
  displayName: string
  phone: string
}): Promise<SessionResult<EntryPayload>> {
  const result = await settle<unknown>(
    getSupabaseClient().rpc('open_session_at_table', {
      p_restaurant_id: input.restaurantId,
      p_branch_id: input.branchId,
      p_table_id: input.tableId,
      p_display_name: input.displayName,
      p_phone: input.phone,
    }),
  )
  if (!result.ok) {
    return result
  }
  try {
    const entry = parseEntry(result.data)
    storeSessionToken(entry.token)
    return { ok: true, data: entry }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}

export async function getSessionContext(): Promise<SessionResult<SessionContextPayload>> {
  const token = readSessionToken()
  if (token === null) {
    return { ok: false, kind: 'validation', message: SESSION_UNAVAILABLE_MESSAGE }
  }
  const result = await settle<unknown>(
    getSupabaseClient().rpc('get_session_context', { p_token: token }),
  )
  if (!result.ok) {
    // The refused-recovery rule: an unavailable session clears the device
    // and returns the customer to entry (FR-014).
    if (result.kind === 'validation' && result.message === SESSION_UNAVAILABLE_MESSAGE) {
      clearSessionToken()
    }
    return result
  }
  try {
    return { ok: true, data: parseSessionContext(result.data) }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}

export async function getSessionMenu(): Promise<SessionResult<SessionMenu>> {
  const token = readSessionToken()
  if (token === null) {
    return { ok: false, kind: 'validation', message: SESSION_UNAVAILABLE_MESSAGE }
  }
  const result = await settle<unknown>(
    getSupabaseClient().rpc('get_session_menu', { p_token: token }),
  )
  if (!result.ok) {
    if (result.kind === 'validation' && result.message === SESSION_UNAVAILABLE_MESSAGE) {
      clearSessionToken()
    }
    return result
  }
  try {
    return { ok: true, data: parseBranchMenu(result.data) }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}

export async function getBranchOpenSessions(
  branchId: string,
): Promise<SessionResult<BranchOpenSessionsPayload>> {
  const result = await settle<unknown>(
    getSupabaseClient().rpc('get_branch_open_sessions', { p_branch_id: branchId }),
  )
  if (!result.ok) {
    return result
  }
  try {
    return { ok: true, data: parseBranchOpenSessions(result.data) }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}

export async function closeSession(sessionId: string): Promise<SessionResult<ClosePayload>> {
  const result = await settle<unknown>(
    getSupabaseClient().rpc('close_session', { p_session_id: sessionId }),
  )
  if (!result.ok) {
    return result
  }
  try {
    return { ok: true, data: parseClose(result.data) }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}
