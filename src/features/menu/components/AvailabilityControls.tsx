import { useState } from 'react'
import { menuClient } from '../menuClient'
import { useMenuInvalidation } from '../useMenu'

/**
 * Availability controls (contracts/menu-client.md §5 flows 6–7; spec 005
 * FR-012/FR-013).
 *
 * Two levels, deliberately distinct:
 *
 *  - `RestaurantAvailabilityToggle` — the owner's restaurant-wide state. Its
 *    copy states the clarified hard stop: turning an item off stops it at
 *    EVERY branch, and no branch override can reverse that.
 *  - `BranchAvailabilityToggle` — one branch's override. It can only hide the
 *    item at that branch; when the item is stopped restaurant-wide it shows
 *    that the toggle currently has no effect (`reason === 'restaurant'`).
 *
 * Both are enabled only where the caller may act (`canManage`), which is
 * presentation only — the RPCs authorize at the data layer (Constitution IV).
 */

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

function useAvailabilityAction(restaurantId: string) {
  const invalidate = useMenuInvalidation()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function run(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
    successMessage: string,
  ) {
    setBusy(true)
    setFeedback(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return false
    }
    invalidate(restaurantId)
    setFeedback({ tone: 'success', message: successMessage })
    return true
  }

  return { busy, feedback, run }
}

export function RestaurantAvailabilityToggle({
  restaurantId,
  itemId,
  itemName,
  isAvailable,
  canManage,
}: {
  restaurantId: string
  itemId: string
  itemName: string
  isAvailable: boolean
  canManage: boolean
}) {
  const { busy, feedback, run } = useAvailabilityAction(restaurantId)

  async function toggle(next: boolean) {
    await run(
      () => menuClient.setItemAvailability(itemId, next),
      next
        ? `"${itemName}" is available again at every branch.`
        : `"${itemName}" is stopped at every branch.`,
    )
  }

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={isAvailable}
          disabled={!canManage || busy}
          onChange={(event) => void toggle(event.target.checked)}
        />
        {`"${itemName}" is available restaurant-wide`}
      </label>
      <p>
        Turning this off stops the item at EVERY branch until it is turned back on — a branch
        override cannot reverse a restaurant-wide stop.
      </p>
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </div>
  )
}

export function BranchAvailabilityToggle({
  restaurantId,
  branchId,
  itemId,
  itemName,
  isAvailableAtBranch,
  unavailableReason,
  canManage,
}: {
  restaurantId: string
  branchId: string
  itemId: string
  itemName: string
  isAvailableAtBranch: boolean
  unavailableReason: 'restaurant' | 'branch' | null
  canManage: boolean
}) {
  const { busy, feedback, run } = useAvailabilityAction(restaurantId)

  async function toggle(next: boolean) {
    await run(
      () => menuClient.setBranchItemAvailability(branchId, itemId, next),
      next
        ? `"${itemName}" is offered at this branch again.`
        : `"${itemName}" is unavailable at this branch.`,
    )
  }

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={isAvailableAtBranch}
          disabled={!canManage || busy}
          onChange={(event) => void toggle(event.target.checked)}
        />
        {`"${itemName}" is available at this branch`}
      </label>
      {unavailableReason === 'restaurant' && (
        <p>
          This item is stopped restaurant-wide, so this branch’s setting has no effect until the
          restaurant-wide stop is lifted.
        </p>
      )}
      {unavailableReason === 'branch' && <p>Unavailable at this branch only.</p>}
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </div>
  )
}
