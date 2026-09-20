# Contract: Session Client, Routes, and Surfaces (Phase 6)

**Feature**: `007-customer-sessions` | **Database contract**: [database-functions.md](./database-functions.md)

## §1 Feature module (`src/features/session/`)

- `sessionClient.ts` — the typed wrapper over the seven RPCs and the **only** import path for them in application code (the 005/006 pattern): one RPC round trip per call, no authorization logic, no optimistic writes; every wrapper reports a result union — `ok: true` with parsed data, or `ok: false` with a kind (`42501` → `"denied"` with the generic denial message; `P0001` → `"validation"` with the server message verbatim; anything else → `"retry"`) rather than thrown exception classes; the jsonb payloads are parsed into typed structures (`SessionPayloadError` on malformed shapes ⇒ the retry kind).
- `useSession.ts` — react-query hooks: `usePublicRestaurant(slug)`, `useEnterSession()` mutation, `useSessionContext()` (reads the stored token, disabled when absent), `useSessionMenu()`, `useBranchOpenSessions(branchId)`, `useCloseSession()` mutation. Query keys carry the token scope so a close invalidates customer reads; the staff list invalidates on close.
- `components/RestaurantEntry.tsx` — the public entry flow: branch selection (skipped when one active branch), table selection (active tables only), name/phone form with the validation bounds, submit → `open_session_at_table` → store the token → navigate to the menu route.
- `components/SessionIndicator.tsx` — the minimal persistent indicator (restaurant · branch · table) rendered on the customer experience; a link back to the menu route; no controls.
- `components/BranchSessionsPanel.tsx` — staff oversight: the branch's open sessions (table, opened time, participants), the close action with the authorized roles, the audit-backed confirmation.

## §2 Token storage rules (`sessionClient.ts`)

- Key: `restopilot.session-token` (single, documented `localStorage` key).
- Write: only on a successful `open_session_at_table` (the token is returned once — FR-011).
- Read: on customer-route mounts via `useSessionContext`; the raw token travels only in RPC arguments over `https`, never in a URL after entry (research §1).
- Clear: on a refused recovery (`P0001` "This session is no longer available.") — the device returns to entry (FR-014); the customer re-enters through the standard flow (FR-006).
- The staff side never reads the token; staff authorization is the existing signed-in identity.

## §3 Routes

| Route | Access | Renders |
|---|---|---|
| `/r/:slug` | public | `RestaurantPublicPage` — the entry flow (FR-001…FR-004); unknown slug → not-found state |
| `/r/:slug/menu` | public (token-guarded) | `CustomerMenuPage` — feature 005's branch menu payload + `SessionIndicator` (FR-021) |
| `/dashboard/sessions` | staff | `StaffSessionsPage` — branch-scoped oversight + close (FR-017/FR-009) |
| `/dashboard` | staff | EXTENDED: a "Sessions" navigation entry (staff-visible) |
| `/dashboard/branches/:branchId` | staff | EXTENDED: link to the branch's sessions view |

- Customer routes render without dashboard chrome; a token-guarded route with a missing/invalid token redirects to `/r/:slug` (the branch inferred from the recovered context when available).
- The staff pages use the existing dashboard layout and auth guards (signed-in required).

## §4 Guard rules (presentation-only — Constitution IV)

- `useAuthContext` adds `canViewSessions(branchId)` and `canCloseSession(branchId)` — true for owner (any branch of own restaurant), branch manager/cashier (own branch), false otherwise (kitchen included). They control **visibility only**: the data layer is the boundary (`get_branch_open_sessions` / `close_session` deny server-side).
- The customer side has no auth context at all: presence of a stored token is a **navigation hint**, never the boundary — every customer RPC verifies the token server-side (FR-020).
