import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import type { Database } from '../../types/database.types'

/**
 * Menu client module (contracts/menu-client.md §1) — the typed wrapper over
 * the menu RPCs and the ONLY import path for them in application code, so the
 * result shaping and the error mapping stay auditable in one place.
 *
 * The module carries NO authorization logic and NO optimistic writes: every
 * wrapper performs one RPC round trip and reports the server's own outcome
 * (the enforced boundary is the RPC surface — Constitution IV). A raw database
 * error never reaches the caller: `42501` becomes the generic denial,
 * `P0001` the server's human-written validation message verbatim, and anything
 * else the retry message (contract §1).
 *
 * Prices and adjustments travel as canonical two-decimal STRINGS (money.ts):
 * PostgREST casts them to `numeric` exactly, so no floating-point value ever
 * crosses the wire.
 */

export type MenuCategoryRow = Database['public']['Tables']['menu_categories']['Row']
export type MenuItemRow = Database['public']['Tables']['menu_items']['Row']
export type MenuItemExtraRow = Database['public']['Tables']['menu_item_extras']['Row']
export type BranchUnavailableItemRow =
  Database['public']['Tables']['branch_unavailable_items']['Row']

/** Why a call failed — the client never distinguishes further than this. */
export type MenuErrorKind = 'denied' | 'validation' | 'retry'

/** The one result shape every wrapper returns (contract §1). */
export type MenuResult<T> =
  { ok: true; data: T } | { ok: false; kind: MenuErrorKind; message: string }

/** SQLSTATE `42501` ⇒ this generic denial (contract §1). */
export const MENU_DENIED_MESSAGE =
  'Not permitted. Your account does not have permission to perform this action.'

/** Anything the RPCs never produce (e.g. a transient failure) ⇒ this retry. */
export const MENU_RETRY_MESSAGE = 'The request could not be completed. Please try again.'

/**
 * Map a PostgREST error to the module's contract: a denial, the server's own
 * validation message (surfaced verbatim), or the retry fallback.
 */
export function mapMenuError(error: Pick<PostgrestError, 'code' | 'message'>): {
  kind: MenuErrorKind
  message: string
} {
  if (error.code === '42501') {
    return { kind: 'denied', message: MENU_DENIED_MESSAGE }
  }
  if (error.code === 'P0001') {
    return { kind: 'validation', message: error.message }
  }
  return { kind: 'retry', message: MENU_RETRY_MESSAGE }
}

/** Awaits one row-returning RPC and normalizes it into the result shape. */
async function settle<T>(request: PromiseLike<PostgrestSingleResponse<T>>): Promise<MenuResult<T>> {
  try {
    const { data, error } = await request
    if (error !== null) {
      return { ok: false, ...mapMenuError(error) }
    }
    if (data === null) {
      return { ok: false, kind: 'retry', message: MENU_RETRY_MESSAGE }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, kind: 'retry', message: MENU_RETRY_MESSAGE }
  }
}

/** Awaits one void-returning RPC: success is the absence of an error. */
async function settleVoid(
  request: PromiseLike<PostgrestSingleResponse<undefined>>,
): Promise<MenuResult<undefined>> {
  try {
    const { error } = await request
    if (error !== null) {
      return { ok: false, ...mapMenuError(error) }
    }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, kind: 'retry', message: MENU_RETRY_MESSAGE }
  }
}

/**
 * The RPC argument for a money value. PostgREST casts a JSON string to
 * `numeric` exactly, so the canonical two-decimal string is what must travel —
 * the generated types describe `numeric` as `number`, hence the documented
 * cast. The value on the wire stays a string (research.md §9).
 */
function moneyArg(canonical: string): number {
  return canonical as unknown as number
}

export interface CreateMenuCategoryInput {
  restaurantId: string
  name: string
  description?: string | null
}

export interface UpdateMenuCategoryInput {
  categoryId: string
  name: string
  description?: string | null
}

export interface CreateMenuItemInput {
  categoryId: string
  name: string
  description?: string | null
  /** Canonical two-decimal string (money.ts). */
  price: string
}

export interface UpdateMenuItemInput {
  itemId: string
  name: string
  description?: string | null
  price: string
}

export const menuClient = {
  /** FR-005: create a category (appends to the restaurant's order). */
  async createCategory(input: CreateMenuCategoryInput): Promise<MenuResult<MenuCategoryRow>> {
    return settle(
      getSupabaseClient().rpc('create_menu_category', {
        p_restaurant_id: input.restaurantId,
        p_name: input.name,
        p_description: input.description ?? undefined,
      }),
    )
  },

  /** FR-005: rename/redescribe a category. An unchanged save is a silent no-op. */
  async updateCategory(input: UpdateMenuCategoryInput): Promise<MenuResult<MenuCategoryRow>> {
    return settle(
      getSupabaseClient().rpc('update_menu_category', {
        p_category_id: input.categoryId,
        p_name: input.name,
        p_description: input.description ?? undefined,
      }),
    )
  },

  /** FR-006: remove an EMPTY category (a non-empty one is rejected by the server). */
  async deleteCategory(categoryId: string): Promise<MenuResult<undefined>> {
    return settleVoid(
      getSupabaseClient().rpc('delete_menu_category', { p_category_id: categoryId }),
    )
  },

  /** FR-009: submit the complete ordered category list for the restaurant. */
  async reorderCategories(
    restaurantId: string,
    categoryIds: string[],
  ): Promise<MenuResult<undefined>> {
    return settleVoid(
      getSupabaseClient().rpc('reorder_menu_categories', {
        p_restaurant_id: restaurantId,
        p_category_ids: categoryIds,
      }),
    )
  },

  /** FR-007/FR-010: create an item in a category. */
  async createItem(input: CreateMenuItemInput): Promise<MenuResult<MenuItemRow>> {
    return settle(
      getSupabaseClient().rpc('create_menu_item', {
        p_category_id: input.categoryId,
        p_name: input.name,
        p_description: input.description ?? undefined,
        p_price: moneyArg(input.price),
      }),
    )
  },

  /** FR-007/FR-010: edit an item's name, description, and price. */
  async updateItem(input: UpdateMenuItemInput): Promise<MenuResult<MenuItemRow>> {
    return settle(
      getSupabaseClient().rpc('update_menu_item', {
        p_item_id: input.itemId,
        p_name: input.name,
        p_description: input.description ?? undefined,
        p_price: moneyArg(input.price),
      }),
    )
  },

  /** FR-007: move an item to another category of the same restaurant. */
  async moveItem(itemId: string, categoryId: string): Promise<MenuResult<MenuItemRow>> {
    return settle(
      getSupabaseClient().rpc('move_menu_item', {
        p_item_id: itemId,
        p_category_id: categoryId,
      }),
    )
  },

  /** FR-009: submit the complete ordered item list for one category. */
  async reorderItems(categoryId: string, itemIds: string[]): Promise<MenuResult<undefined>> {
    return settleVoid(
      getSupabaseClient().rpc('reorder_menu_items', {
        p_category_id: categoryId,
        p_item_ids: itemIds,
      }),
    )
  },

  /**
   * FR-012: the restaurant-wide availability state. `false` is the hard stop —
   * the item is unavailable at every branch until it is set back to `true`,
   * regardless of any branch override (clarified 2026-09-17).
   */
  async setItemAvailability(
    itemId: string,
    isAvailable: boolean,
  ): Promise<MenuResult<MenuItemRow>> {
    return settle(
      getSupabaseClient().rpc('set_menu_item_availability', {
        p_item_id: itemId,
        p_is_available: isAvailable,
      }),
    )
  },

  /**
   * FR-013: the branch's own override. `false` marks the item unavailable at
   * that branch only; `true` clears the override. Resolves to whether the call
   * actually changed anything (a repeat is an idempotent no-op).
   */
  async setBranchItemAvailability(
    branchId: string,
    itemId: string,
    isAvailableAtBranch: boolean,
  ): Promise<MenuResult<boolean>> {
    return settle(
      getSupabaseClient().rpc('set_branch_item_availability', {
        p_branch_id: branchId,
        p_item_id: itemId,
        p_is_available_at_branch: isAvailableAtBranch,
      }),
    )
  },

  /**
   * FR-014/FR-015: the branch's menu as customers see it, computed in the
   * database (one round trip — research.md §3/§5). The payload is validated
   * before it is typed, so a malformed response fails loudly instead of
   * rendering half a menu.
   */
  async getBranchMenu(branchId: string): Promise<MenuResult<BranchMenu>> {
    const result = await settle(
      getSupabaseClient().rpc('get_branch_menu', { p_branch_id: branchId }),
    )
    if (!result.ok) {
      return result
    }
    try {
      return { ok: true, data: parseBranchMenu(result.data) }
    } catch {
      return { ok: false, kind: 'retry', message: MENU_RETRY_MESSAGE }
    }
  },

  /**
   * US5 (contracts/menu-images.md §4): record (or clear) the item's image
   * path. The RPC re-validates the path grammar and returns the PREVIOUS path
   * — null both on first set and on a no-op — so null is a SUCCESS payload
   * here, not a protocol anomaly: the caller deletes the returned previous
   * object, and for a no-op there is deliberately nothing to delete.
   */
  async setItemImage(itemId: string, imagePath: string | null): Promise<MenuResult<string | null>> {
    try {
      const { data, error } = await getSupabaseClient().rpc('set_menu_item_image', {
        p_item_id: itemId,
        // SQL NULL clears the reference. The parameter is required at the SQL
        // level, so `undefined` (an omitted JSON key) would be rejected —
        // send an explicit null; the generated type under-reports that the
        // migration's plain-text parameter accepts it.
        p_image_path: imagePath as string,
      })
      if (error !== null) {
        return { ok: false, ...mapMenuError(error) }
      }
      return { ok: true, data }
    } catch {
      return { ok: false, kind: 'retry', message: MENU_RETRY_MESSAGE }
    }
  },

  /**
   * FR-018/FR-019: add a structured extra to one item. The 20-per-item bound
   * is the server's (enforced under an item-row lock) and its message is
   * surfaced verbatim — the client never pre-empts it with a counter.
   */
  async addMenuItemExtra(input: {
    itemId: string
    name: string
    priceAdjustment: string
  }): Promise<MenuResult<MenuItemExtraRow>> {
    return settle(
      getSupabaseClient().rpc('add_menu_item_extra', {
        p_item_id: input.itemId,
        p_name: input.name,
        p_price_adjustment: moneyArg(input.priceAdjustment),
      }),
    )
  },

  /** FR-018: edit an extra's name and adjustment (an unchanged save writes nothing). */
  async updateMenuItemExtra(input: {
    extraId: string
    name: string
    priceAdjustment: string
  }): Promise<MenuResult<MenuItemExtraRow>> {
    return settle(
      getSupabaseClient().rpc('update_menu_item_extra', {
        p_extra_id: input.extraId,
        p_name: input.name,
        p_price_adjustment: moneyArg(input.priceAdjustment),
      }),
    )
  },

  /** FR-020: retire an extra — it stops being offered; recorded orders keep theirs. */
  async removeMenuItemExtra(extraId: string): Promise<MenuResult<undefined>> {
    return settleVoid(getSupabaseClient().rpc('remove_menu_item_extra', { p_extra_id: extraId }))
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// The branch menu projection (contracts/database-functions.md §7)
// ─────────────────────────────────────────────────────────────────────────────

/** Why an item is not offered at the projected branch. */
export type BranchMenuUnavailableReason = 'restaurant' | 'branch' | null

export interface BranchMenuExtra {
  id: string
  name: string
  /** Exact two-decimal text — the projection sends money as strings. */
  price_adjustment: string
  sort_order: number
}

export interface BranchMenuItem {
  id: string
  name: string
  description: string | null
  price: string
  sort_order: number
  image_path: string | null
  /** Effective availability at this branch: restaurant state ∧ no override. */
  is_offered: boolean
  unavailable_reason: BranchMenuUnavailableReason
  extras: BranchMenuExtra[]
}

export interface BranchMenuCategory {
  id: string
  name: string
  description: string | null
  sort_order: number
  items: BranchMenuItem[]
}

export interface BranchMenu {
  branch: { id: string; name: string }
  restaurant: { id: string; name: string; slug: string }
  categories: BranchMenuCategory[]
}

/** Thrown when a projection payload does not match the documented shape. */
export class MenuPayloadError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string') {
    throw new MenuPayloadError(`Expected a string at "${key}".`)
  }
  return value
}

function optionalString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new MenuPayloadError(`Expected a string or null at "${key}".`)
  }
  return value
}

function requireNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MenuPayloadError(`Expected a number at "${key}".`)
  }
  return value
}

function requireBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key]
  if (typeof value !== 'boolean') {
    throw new MenuPayloadError(`Expected a boolean at "${key}".`)
  }
  return value
}

function requireArray(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key]
  if (!Array.isArray(value)) {
    throw new MenuPayloadError(`Expected an array at "${key}".`)
  }
  return value
}

function parseExtra(raw: unknown): BranchMenuExtra {
  if (!isRecord(raw)) {
    throw new MenuPayloadError('Expected an extra object.')
  }
  return {
    id: requireString(raw, 'id'),
    name: requireString(raw, 'name'),
    price_adjustment: requireString(raw, 'price_adjustment'),
    sort_order: requireNumber(raw, 'sort_order'),
  }
}

function parseItem(raw: unknown): BranchMenuItem {
  if (!isRecord(raw)) {
    throw new MenuPayloadError('Expected an item object.')
  }
  const reason = raw.unavailable_reason
  if (reason !== null && reason !== 'restaurant' && reason !== 'branch') {
    throw new MenuPayloadError('Expected "restaurant", "branch", or null at "unavailable_reason".')
  }
  return {
    id: requireString(raw, 'id'),
    name: requireString(raw, 'name'),
    description: optionalString(raw, 'description'),
    price: requireString(raw, 'price'),
    sort_order: requireNumber(raw, 'sort_order'),
    image_path: optionalString(raw, 'image_path'),
    is_offered: requireBoolean(raw, 'is_offered'),
    unavailable_reason: reason,
    extras: requireArray(raw, 'extras').map(parseExtra),
  }
}

function parseCategory(raw: unknown): BranchMenuCategory {
  if (!isRecord(raw)) {
    throw new MenuPayloadError('Expected a category object.')
  }
  return {
    id: requireString(raw, 'id'),
    name: requireString(raw, 'name'),
    description: optionalString(raw, 'description'),
    sort_order: requireNumber(raw, 'sort_order'),
    items: requireArray(raw, 'items').map(parseItem),
  }
}

/**
 * Validate and type the `get_branch_menu` payload. Every field the surfaces
 * rely on is checked; an unexpected shape throws `MenuPayloadError` so the
 * caller shows the retry state instead of a partial menu.
 */
export function parseBranchMenu(payload: unknown): BranchMenu {
  if (!isRecord(payload)) {
    throw new MenuPayloadError('Expected a menu object.')
  }
  const branch = payload.branch
  const restaurant = payload.restaurant
  if (!isRecord(branch) || !isRecord(restaurant)) {
    throw new MenuPayloadError('Expected branch and restaurant objects.')
  }
  return {
    branch: { id: requireString(branch, 'id'), name: requireString(branch, 'name') },
    restaurant: {
      id: requireString(restaurant, 'id'),
      name: requireString(restaurant, 'name'),
      slug: requireString(restaurant, 'slug'),
    },
    categories: requireArray(payload, 'categories').map(parseCategory),
  }
}
