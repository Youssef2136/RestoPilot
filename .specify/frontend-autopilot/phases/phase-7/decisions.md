# Phase 07 Decisions (specs/027-menu-management-ux)

## D1 — Move buttons over drag-and-drop for reorder (Q1)
Category and item reordering stay keyboard-accessible 'Move up'/'Move down' buttons submitting
the complete ordered list through the existing RPC — no drag library introduced, no pointer-only
affordance. FR-07 is satisfied by construction; the frozen category-row names passed unedited.

## D2 — Availability is an off switch; no item deletion invented (Q2)
The RPC set has NO `delete_menu_item` and `delete_menu_category` refuses non-empty categories —
the UI never pretends otherwise. A stopped item is stopped (restaurant-wide or per branch) with
the blast radius spelled out next to the control; deleting a non-empty category surfaces the
server's consequence verbatim and nothing disappears. The E2E owner journey's cleanup is
legal-only: extras retired, image removed, item stopped.

## D3 — Mobile is read + toggles + simple edits; the upload affordance is swapped same-DOM (Q3)
Below 768px rows fall back to cards and `.uploadAffordance{display:none}` /
`.uploadBoundaryNote{display:block}` replace the file input with the boundary note — one DOM,
CSS-only dual posture (the 025/026 same-DOM lesson). The editor's name/description/price fields
stay usable at 390px; extras editing stays reachable; image work is explicitly deferred with the
note's wording.

## D4 — Limits are shown before the attempt (Q4)
The price hint names the canonical format next to the field; the image field names the accepted
types and the 5 MB bound in its label; the 20-extras ceiling is the server's verbatim refusal —
the client never pre-counts or pre-empts the database's rules.

## D5 — The item editor is a SECTION, not a form (nested-form break fix)
MenuItemEditor renders `section[aria-label="Edit <item>"]` hosting the `Item details for <item>`
save form plus ExtrasEditor and ItemImageField. A `<form>` inside a `<form>` is invalid HTML —
the browser drops the inner element from the parse and every nested submit broke silently (the
React DOM warning names it; the Add-extra submit fired the outer form's no-op). The editor keeps
its accessible name on the section; the save form carries `Item details for <item>`.

## D6 — The editor stays open on save; Close is the dismissal
A changed save keeps the editor open (the flow continues into extras/image work); a no-change
save reports 'No changes to save.' (the server wrote nothing — the editor must not claim a
change). After a rename the form's accessible name follows the item's NEW name.

## D7 — Realtime dual-key invalidation + a schema identity fix for restores
One `branch_unavailable_items` subscription invalidates the whole `['menu']` root via
`invalidateMenuForRealtime` (branch keys are children of it), so both projections — the
customer-visible branch menu and the restaurant availability surface — land mid-service toggles
without a manual refresh. The exit-criterion E2E exposed a REAL backend gap: the table's default
replica identity put only `id` into DELETE payloads, so restore events matched neither the
channel filter nor the RLS policy and were silently dropped. Fix:
`20260930090000_menu_override_replica_identity.sql` sets REPLICA IDENTITY FULL (the table is the
presence-only immutable override; no UPDATE paths exist).

## D8 — One-click-verified toggle helper (E2E)
The availability checkbox is controlled and its `checked` prop lags the invalidate→refetch round
trip; Playwright's check()/uncheck() poll that state and can toggle a row twice. The helper
waits for the opposite state, fires exactly one click, then waits for the prop to land; callers
assert the server's success text as the real state change.
