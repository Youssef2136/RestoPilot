# RestoPilot — Release notes (the frontend's first production release)

What shipped, in user terms, across the frontend phases (01–19). For
operators: the deploy/rollback/runbook story lives in
`docs/production-runbook.md`; this file is the record of what users get.

## For guests (the people at the table)

- **Join a table and order in seconds.** Scan the table's QR code, tell
  the app who you are, and the menu opens — no app install, no account
  creation. The form knows the restaurant, the branch, and the table
  from the link.
- **A menu that stays honest.** Items show exactly what's available;
  prices, taxes, and totals are computed server-side and rendered as
  data — never invented client-side. Media is lazy and only loads when
  real.
- **Your order's whole story.** Every round you send shows up in your
  history with its live kitchen/cashier status; the bill view shows
  what's been served and what's left; a voided round disappears from
  your bill with its reason recorded.
- **Works on your phone.** Every screen is built for 320–430 px phones,
  tablets, and desktop; the cart is a sticky bottom sheet a thumb can
  reach; nothing overflows or hides.
- **Honest states everywhere.** If the connection drops, the app tells
  you and keeps what you can still read obviously stale; if the kitchen
  is not accepting (a cutoff), the cart says so and preserves your
  order; nothing spins forever and nothing shows a fake success.

## For restaurant staff

- **Cashier**: a live rounds board — new orders arrive without a
  refresh; accept → prepare → ready → lock on the card itself; a void
  always asks why, and the reason is recorded and shown verbatim if the
  action is refused.
- **Kitchen**: a money-free ticket queue that updates live, with
  hand-off controls (start → ready) and ticket age; built legible for a
  wall screen.
- **Management**: menu and categories with availability and media,
  branch and tax configuration, staff roster with scoped roles and a
  temporary-password hand-off flow, reports and a void log with date
  anchors, and a full audit trail of who did what.
- **Sessions**: see who's at which table, and end a session when the
  party leaves — with the cutoff preserved for late orders.

## For platform administration

- A console with the tenant list, explicit subscription lifecycle
  (activate/disable/extend), and honest boundaries: a platform admin is
  the platform's admin, never a restaurant's, and the app says so.

## Under the hood (what changed about the product's qualities)

- **Accessible by construction**: every route passes the axe floor, the
  critical journeys are keyboard-complete, focus is managed in dialogs
  and live regions, and the design tokens govern every color and
  spacing decision.
- **Fast where it counts**: route-level code splitting keeps the app's
  first load small (one lazy chunk per page), boards stay smooth under
  a burst of orders, and nothing was optimized without a measurement.
- **Hardened**: strict multi-tenant isolation enforced server-side,
  authorization verified on the database for every operation, and a
  standing suite of hundreds of database and end-to-end tests guarding
  the whole behavior.
- **Honest in production**: loading skeletons (never jank), empty
  states with next actions, verbatim refusals, an offline banner, and a
  single idiom for every failure the app can hit.

The release is reproducible: the deploy build, the bundle guard, and
the deploy rehearsal are one command each (see the runbook), and
rollback is one action on the host.
