# Contract: Menu Client Surface

**Feature**: 005-menu-management | **Date**: 2026-09-17

The application-side contract: the feature module, its routes, the money rules,
the predicates guards consume, and the flows the surfaces must implement. The
data-API contract it calls is [database-functions.md](./database-functions.md);
the storage contract is [menu-images.md](./menu-images.md).

**Presentation-only rule** (Constitution IV; feature 003/004 continuity): every
guard and predicate here controls what is *rendered*. It is never the
authorization boundary — the RPCs and policies are. A surface that renders a
control the server would reject is a defect in the code, not a security hole;
the e2e matrix asserts the reverse direction (out-of-scope deep links render
`NotAuthorized`, rejected rather than hidden).

---

## 1. Module layout (`src/features/menu/`)

| Module | Responsibility |
|--------|----------------|
| `money.ts` | Exact price handling: `PRICE_PATTERN` (`^\d{1,9}(\.\d{1,2})?$`), `isValidPriceInput`, `canonicalizePrice` (trim, reject, pad to two decimals), `formatPrice` (display only, `Intl.NumberFormat`, two decimals), `formatAdjustment`. **No arithmetic** on amounts in this phase (research.md §9) |
| `menuClient.ts` | Typed wrappers over the fifteen functions; `42501` → `AuthorizationError`, `P0001` → `ValidationError` (message surfaced verbatim); `parseBranchMenu(payload)` validating and typing the `get_branch_menu` jsonb (rejects malformed payloads loudly rather than rendering half a menu) |
| `menuImages.ts` | Bucket path builder, client pre-checks, upload/replace/remove orchestration ([menu-images.md](./menu-images.md)) |
| `useMenu.ts` | React Query hooks: `useRestaurantMenu(restaurantId)` (categories, items, extras, overrides read under policies), `useBranchMenu(branchId)` (`get_branch_menu`), and mutations wrapping `menuClient` with the invalidation rules of §4 |
| `components/` | `MenuStructurePanel`, `MenuItemEditor`, `ExtrasEditor`, `ItemImageField`, `AvailabilityControls`, `BranchMenuPreview` |

## 2. Routes

| Route | Audience | Content |
|-------|----------|---------|
| `/dashboard/menu` | owners (in-page guard; others render `NotAuthorized`) | The restaurant's menu: categories (create/rename/describe/reorder/delete-when-empty), items (create/edit/move/reorder), prices, extras, images, the restaurant-wide availability toggle, and per-branch availability for any branch |
| `/dashboard/branches/:branchId/menu` | owner **or** a branch-scoped member of that branch | The branch's menu as customers see it (the `get_branch_menu` projection) with a **customer-view toggle** (hide unoffered items) and, for owners and that branch's manager, the branch availability toggle with the item's `unavailable_reason` shown |

Both routes are registered in `src/app/router.tsx` under the existing
`/dashboard` guard chain; `DashboardPage.tsx` gains the owner's "Menu" entry and
`BranchDetailPage.tsx` a link to the branch's menu view.

## 3. Predicates (`src/features/auth/useAuthContext.ts`)

| Predicate | True when | Used by |
|-----------|-----------|---------|
| `canManageRestaurant(restaurantId)` | existing owner predicate (feature 004) | `/dashboard/menu`, all content controls |
| `canManageBranchAvailability(branchId)` | owner of the branch's restaurant, or a `branch_manager` membership on that branch | branch availability toggles |
| `canViewBranchMenu(branchId)` | owner of the branch's restaurant, or **any** branch-scoped membership on that branch | access to the branch menu route, `useBranchMenu` |

The predicates read `current_auth_context` rows only; no extra query is added.

## 4. Cache and invalidation rules

- Query keys: `['menu', restaurantId]`, `['menu', restaurantId, 'branch', branchId]`,
  `['menu', restaurantId, 'overrides']`.
- Every menu mutation invalidates the restaurant's menu queries **and** every
  branch projection of that restaurant (`invalidateQueries({ queryKey: ['menu', restaurantId] })`),
  so a save can never leave the branch view showing pre-change availability —
  the exit condition's promise, kept in the UI as well as in the data layer.
- Mutations do not write optimistic values for availability or prices: the
  authoritative value is the server's response (Constitution V).

## 5. Required flows

| # | Flow | Rules the surface must honour |
|---|------|-------------------------------|
| 1 | Build the structure | Create category → create items in it → reorder by submitting the complete ordered list (the RPC rejects partial lists, and the UI surfaces that message) |
| 2 | Edit an item | Name/description/price; the price field validates against `PRICE_PATTERN` before submit and sends the canonical string; an unchanged save is allowed and produces no audit record (the UI must not imply a change occurred) |
| 3 | Move / reorder items | Move offers only categories of the same restaurant; reorder submits the category's complete item list |
| 4 | Manage extras | Add/edit/retire; the 20-extras bound is surfaced from the server message, never pre-empted by a client counter (the server's bound is the truth) |
| 5 | Image | Add/replace/remove per [menu-images.md](./menu-images.md) §4, including rejected-upload feedback and the "previous image removed" follow-up |
| 6 | Restaurant-wide stop | The owner toggles an item unavailable; the surface explains that this stops the item **at every branch** and that branch overrides cannot reverse it (the clarified hard-stop rule, stated in the confirmation copy) |
| 7 | Branch availability | Owner or that branch's manager toggles the branch override; the UI shows the resulting effective state and, when the item is stopped restaurant-wide, that the branch toggle currently has no effect (`unavailable_reason: "restaurant"`) |
| 8 | Branch customer view | The projection renders in the server's order; the customer-view toggle hides `is_offered = false` items; items hidden by an override are shown to staff with their reason |

## 6. Error, empty, and loading states

- Every mutation surfaces the server's `P0001` message verbatim next to the
  control that caused it; `42501` renders the authorization message and marks
  the view stale (refetch), because the caller's memberships may have changed
  (feature 003 FR-006).
- Empty states: a restaurant with no categories shows a create-category prompt;
  a category with no items shows an item prompt; an item with no extras shows
  the add-extra control; a branch whose projection is empty renders an empty
  menu rather than an error.
- Loading: skeletons on the two menu routes; the branch route renders nothing
  rather than a partially typed payload if `parseBranchMenu` rejects one.

## 7. Out of contract

- No client-side computation of effective availability, prices, or totals.
- No direct table writes (there are no write grants to use).
- No anonymous storage access or public image URLs in this phase
  ([menu-images.md](./menu-images.md) §6).
- No realtime subscription (`012`), no bulk import, no printing
  (spec Out of Scope).
