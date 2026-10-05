# Phase 08 Findings

## F1 — REAL pre-existing bug: branch-adjacent reorders never worked (fixed)
The panel submitted the DISPLAYED list (restaurant + branch-only interleaved); the RPC counts
and validates ONE context, so any move adjacent to a branch-only rule was refused with 'The
reorder list must contain every rule of the context exactly once.' The E2E's reorder legs
caught it on the first full journey; fixed to per-context swap + per-context submission.

## F2 — REAL client/server parity bug: delete was over-restricted (fixed)
The client's isUnreferenced counted the rule's own outgoing compoundSourceIds as blocking;
`delete_unused_tax_rule` only refuses INCOMING references ('the rule's own outgoing citations
die with it' — junction rows cascade). Compound rules were wrongly denied their Delete button.

## F3 — REAL affordance gap: an override could never be cleared from the row (fixed)
Controls rendered only while origin === 'restaurant'; once overridden, the row offered nothing
— the state matrix's 'clearing' arm had no surface until this phase added 'Use restaurant
default' on overridden rows.

## F4 — The spec-006 executable guard collided with D1 (superseded deliberately)
'no surface of this feature records snapshots' (clarification 3, an Object.keys guard over
taxClient) failed the moment the audited mapping landed. Superseded by the owner-approved D1:
the guard now asserts exactly one audited path (recordSnapshot) — the RPC's owner-only
authorization remains the boundary, and the once-only/cross-tenant guards above it are
untouched.

## F5 — Cross-file T2 race is structural, and the new file's scheduling exposed it
customer.menu asserts exact bill shapes on the SESSION-scoped history; reports.surfaces joins
the same T2 and submits rounds. Worker-timing shifts made the overlap intermittent across
phases ('Subtotal ×3' strict violations). Closed with the t2Lock mutex + scoping the 390px
assertions to this round's panel; the session-scoped accumulation itself is by design.

## F6 — bill.void's bare `.first()` over lock-state cards can resolve the SEEDED voided round
The fixture carries a voided lock-state T2 round ('E2E: wrong order'); at the instant of the
Lock click the page still renders the pre-refetch mix, so `.first()` grabbed the voided card
(no Void control). Fixed by excluding [data-voided="true"] in the selection locator — a
test-hardening change, zero pinned assertions touched.

## F7 — Tablet-project transient worker crash (infrastructure, not regression)
The combined full run crashed one tablet worker (Target crashed / exit 0xC0000002) taking 7
entry-smoke tests with it; the identical project passed 9/9 isolated immediately after, and
chromium+mobile were green in the same combined run. Recorded as environment noise; the
per-project evidence stands.

## F8 — Editor/region mechanics (for future phases)
`div[aria-label]` is NOT a region — the live region needed `<section aria-label>`. StatusPill
is hard-typed to Active/Inactive; tax rows use the module's own pill classes (Active/Retired)
rather than widening the shared component. The rule-form's input ids are keyed by
name.length+rate.length — labels stay unique while drafts change.
