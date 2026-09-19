import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabase'
import {
  menuClient,
  type BranchMenu,
  type BranchUnavailableItemRow,
  type MenuCategoryRow,
  type MenuItemExtraRow,
  type MenuItemRow,
} from './menuClient'

/**
 * Menu reads and their invalidation rules (contracts/menu-client.md §4).
 *
 * The management surfaces read the four menu tables directly under the
 * existing policies — an owner sees every branch of the restaurant, a
 * branch-scoped member their own branch's overrides — and this module
 * assembles them into the tree the editor renders. The branch projection the
 * exit condition turns on is NOT computed here: it comes from the database
 * (`get_branch_menu`), so no client ever derives the effective availability
 * (Constitution V; research.md §3).
 *
 * One query-key root (`['menu', restaurantId, …]`) means every mutation
 * invalidates the restaurant's whole menu surface — including the branch
 * projections — in one call, so a save can never leave a stale availability
 * on screen.
 */

export interface MenuItemNode extends MenuItemRow {
  extras: MenuItemExtraRow[]
  /** Branches that carry an override hiding this item. */
  unavailableBranchIds: string[]
}

export interface MenuCategoryNode extends MenuCategoryRow {
  items: MenuItemNode[]
}

export interface MenuTree {
  categories: MenuCategoryNode[]
  /** Every item of the restaurant, keyed by id (for cross-category lookups). */
  itemsById: Map<string, MenuItemNode>
}

export function menuQueryKey(restaurantId: string | null) {
  return ['menu', restaurantId] as const
}

/**
 * Branch projections are keyed under the menu root but NOT under a restaurant
 * id: the view learns its restaurant from the projection itself, so keying it
 * by restaurant would leave it un-invalidated. `invalidateMenu` clears both
 * prefixes.
 */
export function branchMenuQueryKey(branchId: string | null) {
  return ['menu', 'branch', branchId] as const
}

function compareOrder<T extends { sort_order: number; created_at?: string; id: string }>(
  a: T,
  b: T,
): number {
  const bySort = a.sort_order - b.sort_order
  if (bySort !== 0) {
    return bySort
  }
  const byCreated = (a.created_at ?? '').localeCompare(b.created_at ?? '')
  return byCreated !== 0 ? byCreated : a.id.localeCompare(b.id)
}

/**
 * Read the restaurant's menu as the caller's policies allow and assemble it
 * into the editor's tree (categories in order, their items in order, each
 * item's extras and override branches).
 */
export async function fetchRestaurantMenu(restaurantId: string | null): Promise<MenuTree> {
  if (restaurantId === null) {
    return { categories: [], itemsById: new Map() }
  }
  const supabase = getSupabaseClient()
  const [categories, items, extras, overrides] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId),
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
    supabase.from('menu_item_extras').select('*').eq('restaurant_id', restaurantId),
    supabase.from('branch_unavailable_items').select('*').eq('restaurant_id', restaurantId),
  ])
  const failure = categories.error ?? items.error ?? extras.error ?? overrides.error
  if (failure !== null) {
    throw failure
  }

  const extrasByItem = new Map<string, MenuItemExtraRow[]>()
  for (const extra of (extras.data ?? []).slice().sort(compareOrder)) {
    const bucket = extrasByItem.get(extra.item_id)
    if (bucket === undefined) {
      extrasByItem.set(extra.item_id, [extra])
    } else {
      bucket.push(extra)
    }
  }

  const overridesByItem = new Map<string, string[]>()
  for (const override of (overrides.data ?? []) as BranchUnavailableItemRow[]) {
    const bucket = overridesByItem.get(override.item_id)
    if (bucket === undefined) {
      overridesByItem.set(override.item_id, [override.branch_id])
    } else {
      bucket.push(override.branch_id)
    }
  }

  const itemsById = new Map<string, MenuItemNode>()
  const itemsByCategory = new Map<string, MenuItemNode[]>()
  for (const item of (items.data ?? []).slice().sort(compareOrder)) {
    const node: MenuItemNode = {
      ...item,
      extras: extrasByItem.get(item.id) ?? [],
      unavailableBranchIds: overridesByItem.get(item.id) ?? [],
    }
    itemsById.set(item.id, node)
    const bucket = itemsByCategory.get(item.category_id)
    if (bucket === undefined) {
      itemsByCategory.set(item.category_id, [node])
    } else {
      bucket.push(node)
    }
  }

  const categoryNodes: MenuCategoryNode[] = (categories.data ?? [])
    .slice()
    .sort(compareOrder)
    .map((category) => ({ ...category, items: itemsByCategory.get(category.id) ?? [] }))

  return { categories: categoryNodes, itemsById }
}

/** The management view of one restaurant's menu. */
export function useRestaurantMenu(restaurantId: string | null): UseQueryResult<MenuTree, Error> {
  return useQuery({
    queryKey: menuQueryKey(restaurantId),
    queryFn: () => fetchRestaurantMenu(restaurantId),
    enabled: restaurantId !== null,
  })
}

/**
 * Invalidate every menu-derived query — the editor tree of the restaurant
 * that changed and every branch projection. Over-invalidating (the
 * projections are small and shared) is deliberate: a save must never leave a
 * stale availability on screen (contracts/menu-client.md §4; FR-015).
 */
export function invalidateMenu(queryClient: QueryClient, restaurantId: string): void {
  void queryClient.invalidateQueries({ queryKey: menuQueryKey(restaurantId) })
  void queryClient.invalidateQueries({ queryKey: ['menu', 'branch'] })
}

/** Convenience hook for components that mutate and then invalidate. */
export function useMenuInvalidation(): (restaurantId: string) => void {
  const queryClient = useQueryClient()
  return (restaurantId: string) => invalidateMenu(queryClient, restaurantId)
}

/**
 * The branch's customer-visible menu (FR-014/FR-015), straight from
 * `get_branch_menu` — the database computes the effective availability, so
 * nothing here derives it. The projection is scope-checked server-side; an
 * out-of-scope branch resolves as an error, and the surface renders the
 * denial state rather than an empty menu.
 */
export function useBranchMenu(branchId: string | null): UseQueryResult<BranchMenu, Error> {
  return useQuery({
    queryKey: branchMenuQueryKey(branchId),
    queryFn: async () => {
      const result = await menuClient.getBranchMenu(branchId as string)
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    enabled: branchId !== null,
  })
}
