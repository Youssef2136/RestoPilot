# Phase 08 Decisions (specs/028-tax-configuration-ux)

## D1 — Snapshot surface: IN (user decision, clarify)
One owner-only action on the restaurant tax page records the branch's currently saved
configuration under a user-composed label; the fingerprint binds label + branch + rule content,
so a changed configuration is a new snapshot while an identical re-record states the once-only
outcome without an error. The button label stays STABLE ('Record snapshot' / 'Recording…') —
outcomes render in the status paragraph, keeping the attempt always available.

## D2 — Basket presets: OUT (user decision, clarify)
The free-form builder + Calculate + empty-basket state cover SC-01; no preset baskets.

## D3 — Precedence as a text-bearing badge with its own clearing control
InheritanceBadge ('Inherited' dashed / 'Overridden' warning-tinted, both text-bearing) sits on
each effective rule row; the badge vocabulary deliberately avoids the pinned count-0 strings
('(branch override)'/'Downtown surcharge'). The badge-cycle E2E exposed that an overridden row
had NO control — the fix adds 'Use restaurant default' directly on overridden rows (the
state matrix's 'clearing' arm now has a surface).

## D4 — The reorder submission is per-context
The displayed list merges restaurant-level and branch-only rules; the RPC validates exactly one
context ('The reorder list must contain every rule of the context exactly once.'). The swap now
happens within the moved rule's context and submits ONLY that context's ids — the displayed
merge re-sorts from the refetched (sort_order, name).

## D5 — Delete gating mirrors the server, not a stricter guess
`delete_unused_tax_rule` refuses INCOMING references only (outgoing citations die with the
rule); the client's isUnreferenced was tightened to parity. The cleanup journey exercises the
legal path: a compound rule deletes first; an item-scoped rule has its scope changed to total
(the RPC refuses a zero-target items rule) before delete.

## D6 — Busy holds through the refetch
useTaxInvalidation awaits both invalidated reads; panels keep busy until the UI shows the saved
state (the 027 controlled-checkbox lesson). The E2E then polls through the settle instead of
racing a single click.

## D7 — Structural limits-before-attempt for the rate
A malformed rate disables the submit outright (the RPC is never sent) while the documented hint
rides aria-describedby and the input is preserved — the refusal is the STRUCTURE, and the E2E
asserts it that way.

## D8 — Cross-file T2 mutex (t2Lock)
customer.menu's exact bill assertions and reports.surfaces' rounds share the T2 session; the
new file's scheduling shifted worker timing and surfaced the race. The fionaLock-pattern
t2Lock serializes the two files' T2 spans, and the 390px journey scopes its bill assertions to
its own round's TotalsPanel (session-scoped history legitimately accumulates rounds).
