import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabase'
import {
  taxClient,
  type BranchTaxConfig,
  type TaxCalculation,
  type TaxRuleRow,
  type TaxSelection,
} from './taxClient'

/**
 * Tax reads and their invalidation rules (contracts/tax-client.md §1, §4).
 *
 * The configuration surface reads the tax tables directly under the existing
 * policies — the same plain restaurant-membership arm every tax table grants
 * — and this module assembles them into the shape the panel renders. The
 * calculation projection is NOT derived here: it comes from the database
 * (`calculate_branch_taxes`, US3), so no client ever assembles an effective
 * configuration or computes an amount (Constitution V).
 *
 * One query-key root (`['tax', restaurantId, …]`) means every tax mutation
 * invalidates the restaurant's whole tax surface — the rule list, the branch
 * configurations, and every preview — in one call, so a save can never leave
 * a stale rate or order on screen (FR-011; no optimistic values anywhere).
 */

export interface TaxRuleNode extends TaxRuleRow {
  itemIds: string[]
  categoryIds: string[]
  compoundSourceIds: string[]
}

export interface TaxRuleInventory {
  rules: TaxRuleNode[]
}

export function taxQueryKey(restaurantId: string | null) {
  return ['tax', restaurantId] as const
}

/**
 * Branch previews are keyed under the tax root but NOT under a restaurant id:
 * the view learns its restaurant from the payload itself, so keying it by
 * restaurant would leave it un-invalidated. `invalidateTax` clears both
 * prefixes.
 */
export function branchTaxPreviewKey(branchId: string | null) {
  return ['tax', 'branch', branchId] as const
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
 * Read the restaurant's tax configuration as the caller's policies allow and
 * assemble it into the panel's shape (rules in `(sort_order, name)` order,
 * each with its targets and compound sources).
 */
export async function fetchRestaurantTaxRules(
  restaurantId: string | null,
): Promise<TaxRuleInventory> {
  if (restaurantId === null) {
    return { rules: [] }
  }
  const supabase = getSupabaseClient()
  const [rules, items, categories, compounds] = await Promise.all([
    supabase.from('tax_rules').select('*').eq('restaurant_id', restaurantId),
    supabase.from('tax_rule_items').select('*').eq('restaurant_id', restaurantId),
    supabase.from('tax_rule_categories').select('*').eq('restaurant_id', restaurantId),
    supabase.from('tax_rule_compounds').select('*').eq('restaurant_id', restaurantId),
  ])
  const failure = rules.error ?? items.error ?? categories.error ?? compounds.error
  if (failure !== null) {
    throw failure
  }

  const itemsByRule = new Map<string, string[]>()
  for (const row of (items.data ?? []) as Array<{ rule_id: string; item_id: string }>) {
    const bucket = itemsByRule.get(row.rule_id)
    if (bucket === undefined) {
      itemsByRule.set(row.rule_id, [row.item_id])
    } else {
      bucket.push(row.item_id)
    }
  }

  const categoriesByRule = new Map<string, string[]>()
  for (const row of (categories.data ?? []) as Array<{ rule_id: string; category_id: string }>) {
    const bucket = categoriesByRule.get(row.rule_id)
    if (bucket === undefined) {
      categoriesByRule.set(row.rule_id, [row.category_id])
    } else {
      bucket.push(row.category_id)
    }
  }

  const sourcesByRule = new Map<string, string[]>()
  for (const row of (compounds.data ?? []) as Array<{
    rule_id: string
    source_rule_id: string
  }>) {
    const bucket = sourcesByRule.get(row.rule_id)
    if (bucket === undefined) {
      sourcesByRule.set(row.rule_id, [row.source_rule_id])
    } else {
      bucket.push(row.source_rule_id)
    }
  }

  const ruleNodes: TaxRuleNode[] = ((rules.data ?? []) as TaxRuleRow[])
    .slice()
    .sort(compareOrder)
    .map((rule) => ({
      ...rule,
      itemIds: itemsByRule.get(rule.id) ?? [],
      categoryIds: categoriesByRule.get(rule.id) ?? [],
      compoundSourceIds: sourcesByRule.get(rule.id) ?? [],
    }))

  return { rules: ruleNodes }
}

/** The configuration view of one restaurant's tax rules. */
export function useRestaurantTaxRules(
  restaurantId: string | null,
): UseQueryResult<TaxRuleInventory, Error> {
  return useQuery({
    queryKey: taxQueryKey(restaurantId),
    queryFn: () => fetchRestaurantTaxRules(restaurantId),
    enabled: restaurantId !== null,
  })
}

/**
 * The branch's effective tax configuration (FR-020), straight from
 * `get_branch_tax_config` — the database computes the effective rates and
 * origins, so nothing here derives them. The projection is scope-checked
 * server-side; an out-of-scope branch resolves as an error, and the surface
 * renders the denial state rather than an empty configuration.
 */
export function useBranchTaxConfig(
  branchId: string | null,
): UseQueryResult<BranchTaxConfig, Error> {
  return useQuery({
    queryKey: branchTaxPreviewKey(branchId),
    queryFn: async () => {
      const result = await taxClient.getBranchTaxConfig(branchId as string)
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    enabled: branchId !== null,
  })
}

/**
 * The calculation preview (US3): one engine call per submitted basket, keyed
 * by branch + the exact selections string so a changed basket is a different
 * cache entry — never a recomputation from stale amounts (Constitution V).
 * Enabled only on submit (`enabled` is caller-controlled): not on keystroke.
 */
export function useTaxPreview(
  branchId: string | null,
  selections: TaxSelection[] | null,
): UseQueryResult<TaxCalculation, Error> {
  const selectionsKey = selections === null ? null : JSON.stringify(selections)
  return useQuery({
    queryKey: [...branchTaxPreviewKey(branchId), 'calculation', selectionsKey] as const,
    queryFn: async () => {
      const result = await taxClient.calculateBranchTaxes(
        branchId as string,
        selections as TaxSelection[],
      )
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    enabled: branchId !== null && selectionsKey !== null,
  })
}

/**
 * Invalidate every tax-derived query — the rule inventory of the restaurant
 * that changed, every branch configuration, and every preview.
 * Over-invalidating is deliberate: a save must never leave a stale rate,
 * order, or override on screen (contracts/tax-client.md §4; FR-011).
 */ export function invalidateTax(queryClient: QueryClient, restaurantId: string): void {
  void queryClient.invalidateQueries({ queryKey: taxQueryKey(restaurantId) })
  void queryClient.invalidateQueries({ queryKey: ['tax', 'branch'] })
}

/** Convenience hook for components that mutate and then invalidate. */
export function useTaxInvalidation(): (restaurantId: string) => void {
  const queryClient = useQueryClient()
  return (restaurantId: string) => invalidateTax(queryClient, restaurantId)
}
