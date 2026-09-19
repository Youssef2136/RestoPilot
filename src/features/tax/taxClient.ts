import type { Database } from '../../types/database.types'
import { getSupabaseClient } from '../../lib/supabase'

/**
 * Tax client module (contracts/tax-client.md §1) — the typed wrapper over the
 * tax RPCs and the ONLY import path for them in application code, so the
 * result shaping and the error mapping stay auditable in one place. Features
 * 005's menuClient is the template: no authorization logic, no optimistic
 * writes — every wrapper performs one RPC round trip and reports the server's
 * own outcome (the enforced boundary is the RPC surface — Constitution IV).
 *
 * `42501` becomes the generic denial, `P0001` the server's human-written
 * validation message verbatim, and anything else the retry message. Rates
 * travel as canonical four-decimal STRINGS (taxMoney.ts); the compound source
 * ids and reorder lists travel exactly as submitted.
 *
 * US1 writes the rule surface; the later stories extend this module with the
 * override (US2) and the calculation read (US3).
 */

export type TaxRuleRow = Database['public']['Tables']['tax_rules']['Row']

/** Why a call failed — the client never distinguishes further than this. */
export type TaxErrorKind = 'denied' | 'validation' | 'retry'

/** The one result shape every wrapper returns (contract §1). */
export type TaxResult<T> =
  { ok: true; data: T } | { ok: false; kind: TaxErrorKind; message: string }

/** SQLSTATE `42501` ⇒ this generic denial (contract §1). */
export const TAX_DENIED_MESSAGE =
  'Not permitted. Your account does not have permission to perform this action.'

/** Anything the RPCs never produce (e.g. a transient failure) ⇒ this retry. */
export const TAX_RETRY_MESSAGE = 'The request could not be completed. Please try again.'

/**
 * Map a PostgREST error to the module's contract: a denial, the server's own
 * validation message (surfaced verbatim), or the retry fallback.
 */
export function mapTaxError(error: { code?: string; message: string }): {
  kind: TaxErrorKind
  message: string
} {
  if (error.code === '42501') {
    return { kind: 'denied', message: TAX_DENIED_MESSAGE }
  }
  if (error.code === 'P0001') {
    return { kind: 'validation', message: error.message }
  }
  return { kind: 'retry', message: TAX_RETRY_MESSAGE }
}

/** Awaits one row-returning RPC and normalizes it into the result shape. */
async function settle<T>(
  request: PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>,
): Promise<TaxResult<T>> {
  try {
    const { data, error } = await request
    if (error !== null) {
      return { ok: false, ...mapTaxError(error) }
    }
    if (data === null) {
      return { ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE }
  }
}

/** Awaits one void-returning RPC: success is the absence of an error. */
async function settleVoid(
  request: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
): Promise<TaxResult<undefined>> {
  try {
    const { error } = await request
    if (error !== null) {
      return { ok: false, ...mapTaxError(error) }
    }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE }
  }
}

/**
 * The RPC argument for a rate. PostgREST casts a JSON string to `numeric`
 * exactly, so the canonical four-decimal string is what must travel — the
 * generated types describe `numeric` as `number`, hence the documented cast.
 */
function rateArg(canonical: string): string {
  return canonical as unknown as string
}

export interface CreateTaxRuleInput {
  restaurantId: string
  name: string
  /** Canonical four-decimal string (taxMoney.ts). */
  rate: string
  scope: 'total' | 'items' | 'categories'
  branchId?: string | null
  sortOrder?: number | null
  itemIds?: string[]
  categoryIds?: string[]
  compoundSourceIds?: string[]
}

export interface UpdateTaxRuleInput {
  ruleId: string
  name: string
  /** Canonical four-decimal string (taxMoney.ts). */
  rate: string
  scope: 'total' | 'items' | 'categories'
  sortOrder: number
  itemIds?: string[]
  categoryIds?: string[]
  compoundSourceIds?: string[]
}

export const taxClient = {
  /** FR-005: create a rule (restaurant-level, or branch-only with a branch id). */
  async createRule(input: CreateTaxRuleInput): Promise<TaxResult<TaxRuleRow>> {
    return settle(
      getSupabaseClient().rpc('create_tax_rule', {
        p_restaurant_id: input.restaurantId,
        p_name: input.name,
        p_rate: rateArg(input.rate),
        p_scope: input.scope,
        p_branch_id: input.branchId ?? undefined,
        p_sort_order: input.sortOrder ?? undefined,
        p_item_ids: input.itemIds ?? undefined,
        p_category_ids: input.categoryIds ?? undefined,
        p_compound_source_ids: input.compoundSourceIds ?? undefined,
      }),
    )
  },

  /** FR-005: the full-shape edit — targets and sources are replaced wholesale. */
  async updateRule(input: UpdateTaxRuleInput): Promise<TaxResult<TaxRuleRow>> {
    return settle(
      getSupabaseClient().rpc('update_tax_rule', {
        p_rule_id: input.ruleId,
        p_name: input.name,
        p_rate: rateArg(input.rate),
        p_scope: input.scope,
        p_sort_order: input.sortOrder,
        p_item_ids: input.itemIds ?? undefined,
        p_category_ids: input.categoryIds ?? undefined,
        p_compound_source_ids: input.compoundSourceIds ?? undefined,
      }),
    )
  },

  /** FR-008: submit the complete ordered rule list for one context. */
  async reorderRules(
    restaurantId: string,
    ruleIds: string[],
    branchId?: string | null,
  ): Promise<TaxResult<undefined>> {
    return settleVoid(
      getSupabaseClient().rpc('reorder_tax_rules', {
        p_restaurant_id: restaurantId,
        p_rule_ids: ruleIds,
        p_branch_id: branchId ?? undefined,
      }),
    )
  },

  /**
   * FR-010: retirement is the lifecycle — an inactive rule stops applying to
   * new calculations and stays visible with its state. Reactivating is the
   * same call with `true`.
   */
  async setRuleActive(ruleId: string, isActive: boolean): Promise<TaxResult<TaxRuleRow>> {
    return settle(
      getSupabaseClient().rpc('retire_tax_rule', {
        p_rule_id: ruleId,
        p_active: isActive,
      }),
    )
  },

  /** FR-010's carve-out: delete a rule that was never applied or referenced. */
  async deleteUnusedRule(ruleId: string): Promise<TaxResult<undefined>> {
    return settleVoid(getSupabaseClient().rpc('delete_unused_tax_rule', { p_rule_id: ruleId }))
  },

  /**
   * FR-009: a replacement rate for a restaurant-level rule at one branch.
   * `rate === null` clears the override — the branch returns to the restaurant
   * default. Resolves to whether the call actually changed anything (a repeat
   * is an idempotent no-op).
   */
  async setBranchTaxOverride(input: {
    branchId: string
    ruleId: string
    rate: string | null
  }): Promise<TaxResult<{ changed: boolean; rate: string | null }>> {
    // The jsonb result is validated loosely: the contract is { changed, rate }.
    // `p_rate` is nullable at the SQL level — the generated types under-report
    // that, so null travels through a documented cast (the same posture as
    // feature 005's set_menu_item_image null path).
    const result = await settle(
      getSupabaseClient().rpc('set_branch_tax_override', {
        p_branch_id: input.branchId,
        p_rule_id: input.ruleId,
        p_rate: (input.rate === null ? null : rateArg(input.rate)) as string,
      }),
    )
    if (!result.ok) {
      return result
    }
    const raw = result.data as { changed?: unknown; rate?: unknown }
    if (typeof raw?.changed !== 'boolean') {
      return { ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE }
    }
    return {
      ok: true,
      data: {
        changed: raw.changed,
        rate: typeof raw.rate === 'string' ? raw.rate : null,
      },
    }
  },

  /**
   * FR-020: the branch's effective configuration, computed in the database
   * (one round trip). The payload is validated before it is typed, so a
   * malformed response fails loudly instead of rendering half a
   * configuration.
   */
  async getBranchTaxConfig(branchId: string): Promise<TaxResult<BranchTaxConfig>> {
    const result = await settle(
      getSupabaseClient().rpc('get_branch_tax_config', { p_branch_id: branchId }),
    )
    if (!result.ok) {
      return result
    }
    try {
      return { ok: true, data: parseTaxConfig(result.data) }
    } catch {
      return { ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE }
    }
  },

  /**
   * FR-011–FR-014: the canonical calculation. The selections travel as JSON
   * (item ids, selected extra ids, quantity); every amount comes back
   * computed in SQL `numeric` and rounded once server-side — this wrapper
   * validates the payload and passes it through untouched (Constitution V:
   * the client never computes a value).
   */
  async calculateBranchTaxes(
    branchId: string,
    selections: TaxSelection[],
  ): Promise<TaxResult<TaxCalculation>> {
    // The selections travel as a JSON ARRAY VALUE, not a JSON-encoded string:
    // PostgREST delivers a JS string argument as a jsonb SCALAR (a string),
    // which the engine rejects as malformed. The generated types describe the
    // jsonb parameter as `string`, hence the documented cast — the runtime
    // value is the array PostgREST serializes.
    const result = await settle(
      getSupabaseClient().rpc('calculate_branch_taxes', {
        p_branch_id: branchId,
        p_selections: selections as unknown as string,
      }),
    )
    if (!result.ok) {
      return result
    }
    try {
      return { ok: true, data: parseCalculation(result.data) }
    } catch {
      return { ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// The branch tax configuration projection (contracts/database-functions.md §3)
// ─────────────────────────────────────────────────────────────────────────────

/** Where a rule's effective rate comes from. */
export type TaxOrigin = 'restaurant' | 'branch-only' | 'override'

export interface BranchTaxRule {
  rule_id: string
  name: string
  /** Exact four-decimal text — the projection sends rates as strings. */
  rate: string
  scope: 'total' | 'items' | 'categories'
  sort_order: number
  origin: TaxOrigin
  item_ids: string[]
  category_ids: string[]
  compound_sources: string[]
}

export interface BranchTaxConfig {
  branch: { id: string; name: string }
  restaurant_id: string
  rules: BranchTaxRule[]
}

/** Thrown when a configuration payload does not match the documented shape. */
export class TaxPayloadError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string') {
    throw new TaxPayloadError(`Expected a string at "${key}".`)
  }
  return value
}

function requireNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TaxPayloadError(`Expected a number at "${key}".`)
  }
  return value
}

function requireArray(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key]
  if (!Array.isArray(value)) {
    throw new TaxPayloadError(`Expected an array at "${key}".`)
  }
  return value
}

/** Every element must be a string (the ids the labels resolve from). */
function requireStringArray(source: Record<string, unknown>, key: string): string[] {
  return requireArray(source, key).map((element, index) => {
    if (typeof element !== 'string') {
      throw new TaxPayloadError(`Expected a string at "${key}[${index}]".`)
    }
    return element
  })
}

/**
 * Validate and type the `get_branch_tax_config` payload. Every field the
 * surfaces rely on is checked; an unexpected shape throws `TaxPayloadError`
 * so the caller shows the retry state instead of a partial configuration.
 */
export function parseTaxConfig(payload: unknown): BranchTaxConfig {
  if (!isRecord(payload)) {
    throw new TaxPayloadError('Expected a configuration object.')
  }
  const branch = payload.branch
  if (!isRecord(branch)) {
    throw new TaxPayloadError('Expected a branch object.')
  }
  return {
    branch: { id: requireString(branch, 'id'), name: requireString(branch, 'name') },
    restaurant_id: requireString(payload, 'restaurant_id'),
    rules: requireArray(payload, 'rules').map(parseConfigRule),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The calculation projection (contracts/database-functions.md, calculate_branch_taxes)
// ─────────────────────────────────────────────────────────────────────────────

/** One basket entry as it travels to `calculate_branch_taxes`. */
export interface TaxSelection {
  item_id: string
  extras: Array<{ extra_id: string }>
  quantity: number
}

/** One tax line as the engine reports it. */
export interface TaxLine {
  rule_id: string
  name: string
  /** Exact four-decimal text. */
  rate: string
  scope: 'total' | 'items' | 'categories'
  sort_order: number
  /** Exact two-decimal text — never a float, never recomputed. */
  amount: string
}

/** The engine's full answer for one submitted basket at one branch. */
export interface TaxCalculation {
  lines: TaxLine[]
  subtotal: string
  total: string
}

/**
 * Validate and type the `calculate_branch_taxes` payload. Amounts must be
 * strings (the engine's exact text); a numeric amount would smuggle a float
 * into the display, so it throws. Lines must already arrive in the engine's
 * order — the parser never re-sorts, it only verifies the order is
 * non-decreasing in `(sort_order)` so a malformed payload fails loudly.
 */
export function parseCalculation(payload: unknown): TaxCalculation {
  if (!isRecord(payload)) {
    throw new TaxPayloadError('Expected a calculation object.')
  }
  const lines = requireArray(payload, 'lines').map(parseLine)
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]!.sort_order < lines[index - 1]!.sort_order) {
      throw new TaxPayloadError('Lines are out of order.')
    }
  }
  return {
    lines,
    subtotal: requireString(payload, 'subtotal'),
    total: requireString(payload, 'total'),
  }
}

function parseLine(raw: unknown): TaxLine {
  if (!isRecord(raw)) {
    throw new TaxPayloadError('Expected a line object.')
  }
  const scope = raw.scope
  if (scope !== 'total' && scope !== 'items' && scope !== 'categories') {
    throw new TaxPayloadError('Expected "total", "items", or "categories" at "scope".')
  }
  return {
    rule_id: requireString(raw, 'rule_id'),
    name: requireString(raw, 'name'),
    rate: requireString(raw, 'rate'),
    scope,
    sort_order: requireNumber(raw, 'sort_order'),
    amount: requireString(raw, 'amount'),
  }
}

function parseConfigRule(raw: unknown): BranchTaxRule {
  if (!isRecord(raw)) {
    throw new TaxPayloadError('Expected a rule object.')
  }
  const scope = raw.scope
  if (scope !== 'total' && scope !== 'items' && scope !== 'categories') {
    throw new TaxPayloadError('Expected "total", "items", or "categories" at "scope".')
  }
  const origin = raw.origin
  if (origin !== 'restaurant' && origin !== 'branch-only' && origin !== 'override') {
    throw new TaxPayloadError('Expected "restaurant", "branch-only", or "override" at "origin".')
  }
  return {
    rule_id: requireString(raw, 'rule_id'),
    name: requireString(raw, 'name'),
    rate: requireString(raw, 'rate'),
    scope,
    sort_order: requireNumber(raw, 'sort_order'),
    origin,
    item_ids: requireStringArray(raw, 'item_ids'),
    category_ids: requireStringArray(raw, 'category_ids'),
    compound_sources: requireStringArray(raw, 'compound_sources'),
  }
}
