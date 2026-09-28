import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import type { AuthContextMembership } from '../../features/auth/useAuthContext'
import styles from './ContextSwitcher.module.css'

/**
 * ContextSwitcher (spec 023 FR-03/T004; Clarification Q2): the staff shell's
 * restaurant/branch context in ONE place. Options derive ONLY from what the
 * caller may read: restaurant options group the effective memberships;
 * branch options come from the same policy-scoped `branches` read the
 * dashboard uses. Selection persists across routes via sessionStorage
 * (`restopilot.dashboard-context`); an invalid/foreign persisted id is
 * ignored (falls back to the first valid) — never a foreign tenant name.
 *
 * Labels are deliberately "Where"/"Scope" (Q2): `getByLabel('Restaurant')`
 * / `getByLabel('Branch')` match SUBSTRINGS case-insensitively in Playwright,
 * so the switcher's labels must not contain those words AT ALL — six+ suites
 * assert their count/identity on pages where the switcher also renders
 * ("Viewing branch" still contains "branch"). The page-level selects stay
 * the unambiguous contracts.
 */

const STORAGE_KEY = 'restopilot.dashboard-context'

export type DashboardContext = { restaurantId: string | null; branchId: string | null }

function readStoredContext(): DashboardContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as DashboardContext
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.restaurantId !== 'string' ||
      typeof parsed.branchId !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredContext(context: DashboardContext): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context))
  } catch {
    // Storage unavailable (privacy mode): the switcher still works, it just
    // does not persist across reloads — same posture as the cart's guard.
  }
}

export interface RestaurantOption {
  restaurantId: string
  restaurantName: string
  isOwner: boolean
}

/** Groups the effective memberships into one option per restaurant. */
export function groupByRestaurant(memberships: AuthContextMembership[]): RestaurantOption[] {
  const byId = new Map<string, RestaurantOption>()
  for (const membership of memberships) {
    const existing = byId.get(membership.restaurant_id)
    if (existing) {
      existing.isOwner ||= membership.role === 'owner'
    } else {
      byId.set(membership.restaurant_id, {
        restaurantId: membership.restaurant_id,
        restaurantName: membership.restaurant_name,
        isOwner: membership.role === 'owner',
      })
    }
  }
  return [...byId.values()]
}

/** Branches of a restaurant, through the same policy-scoped read as before. */
async function fetchBranchOptions(restaurantId: string | null) {
  if (restaurantId === null) return []
  const { data, error } = await getSupabaseClient()
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export type ContextSwitcherProps = {
  memberships: AuthContextMembership[]
  /** Reports the resolved context upward (the shell's consumers). */
  onContextChange?: (context: DashboardContext) => void
}

export function ContextSwitcher({ memberships, onContextChange }: ContextSwitcherProps) {
  const restaurants = useMemo(() => groupByRestaurant(memberships), [memberships])

  // Persisted selection, validated against the memberships on mount/update.
  const [selected, setSelected] = useState<DashboardContext | null>(() => {
    const stored = readStoredContext()
    if (stored === null) return null
    const restaurantValid = restaurants.some((r) => r.restaurantId === stored.restaurantId)
    return restaurantValid ? stored : null
  })

  const effectiveRestaurantId = useMemo(() => {
    if (
      selected?.restaurantId &&
      restaurants.some((r) => r.restaurantId === selected.restaurantId)
    ) {
      return selected.restaurantId
    }
    return restaurants[0]?.restaurantId ?? null
  }, [selected, restaurants])

  const selectedRestaurant = restaurants.find(
    (option) => option.restaurantId === effectiveRestaurantId,
  )

  const branchesQuery = useQuery({
    queryKey: ['branches', effectiveRestaurantId],
    queryFn: () => fetchBranchOptions(effectiveRestaurantId),
    enabled: effectiveRestaurantId !== null,
    // The switcher mirrors the dashboard's read; the context key stays the
    // same so both share one cache entry.
    staleTime: 60_000,
  })

  const branchOptions = useMemo(() => {
    const branches = (branchesQuery.data ?? []).map((branch) => ({
      id: branch.id,
      name: branch.name,
    }))
    if (selectedRestaurant?.isOwner) {
      // Owners are restaurant-wide (FR-007): every readable branch plus the
      // whole-restaurant context.
      return [{ id: '', name: 'All branches' }, ...branches]
    }
    return branches
  }, [branchesQuery.data, selectedRestaurant])

  const effectiveBranchId = useMemo(() => {
    if (selected?.branchId && branchOptions.some((option) => option.id === selected.branchId)) {
      return selected.branchId
    }
    return branchOptions[0]?.id ?? ''
  }, [selected, branchOptions])

  // Persist + report the RESOLVED context (not the raw selection).
  useEffect(() => {
    const context: DashboardContext = {
      restaurantId: effectiveRestaurantId,
      branchId: effectiveBranchId || null,
    }
    writeStoredContext(context)
    onContextChange?.(context)
  }, [effectiveRestaurantId, effectiveBranchId, onContextChange])

  if (restaurants.length === 0) return null

  return (
    <div className={styles.switcher}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="context-restaurant">
          Viewing — Where
        </label>
        <select
          id="context-restaurant"
          className={styles.select}
          value={effectiveRestaurantId ?? ''}
          onChange={(event) => {
            // Branch options differ per restaurant — reset the branch.
            setSelected({ restaurantId: event.target.value, branchId: '' })
          }}
        >
          {restaurants.map((restaurant) => (
            <option key={restaurant.restaurantId} value={restaurant.restaurantId}>
              {restaurant.restaurantName}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="context-branch">
          Viewing — Scope
        </label>
        <select
          id="context-branch"
          className={styles.select}
          value={effectiveBranchId}
          onChange={(event) =>
            setSelected({ restaurantId: effectiveRestaurantId, branchId: event.target.value })
          }
          disabled={branchesQuery.isPending}
        >
          {branchOptions.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
