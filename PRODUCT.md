# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Restaurant **owners and their staff** (branch managers, cashiers, kitchen
members) run day-to-day operations: sessions at tables/channels, order rounds,
kitchen preparation, billing oversight, menu and tax configuration, reports,
and the audit trail. A **platform super admin** onboards restaurants and
manages subscriptions. **Customers** are anonymous guests who scan a QR /
open a link, start a session, order rounds, and follow their order status —
no accounts, no staff data, mobile-first.

## Product Purpose

RestoPilot is an **order collection layer** for multi-branch restaurants: it
takes orders from customers at tables or delivery/takeaway channels, routes
them through a kitchen and cashier lifecycle, and gives owners the
configuration (menu, tax, branches, staff) and the truth (reports, audit) —
without ever becoming a POS. Success: orders flow table→kitchen→serve with
verbatim server-truth feedback at every step, across every role.

## Positioning

The external POS stays responsible for payments, printing, and accounting;
RestoPilot owns collection and kitchen flow. Server-enforced authorization
(RLS + RPC) with the UI presenting, never deciding — a neighboring product
cannot copy the "UI renders, server authorizes" posture with per-role RPC
reach baked into 65 public RPCs.

## Operating Context

Restaurants run daily shifts: cashiers watch the rounds queue, kitchen members
work the ticket board (often a tablet at the pass), owners configure menus and
review reports occasionally. Customers act on phones in a hurry — scan, pick,
submit. Realtime keeps staff views live; customers poll. Development runs
against a cloud dev Supabase project with rate-limited auth (30/5min/IP).

## Capabilities and Constraints

- Multi-tenant isolation end to end; roles: owner, branch_manager, cashier,
  kitchen, platform super admin, anonymous customer (session-token scoped).
- Write path is **RPC-only**; the UI never writes business tables. Round
  lifecycle (`new→accepted→preparing→ready→lock`, delivery
  `out_for_delivery→completed`) is server-governed; the UI renders it.
- Money is exact decimal text end to end; totals/taxes are computed in SQL.
- Realtime events invalidate, reads render (payloads never displayed).
- **Not in the product** (do not invent): payments/bill splitting, printing,
  discounts, exports, customer accounts, SMS/WhatsApp/push, i18n/RTL, POS
  integrations, inventory, financial accounting.
- Frozen client contracts: `restopilot.session-token`, `restopilot.cart`
  localStorage keys; the E2E-asserted accessible-name surface.
- Accessibility: WCAG 2.1 AA floor (contrast, visible focus, keyboard
  operability, reduced motion); touch-target minimum 44px on primary actions.

## Brand Commitments

The name **RestoPilot** (text wordmark). No logo, imagery, or corporate
palette exists; the design system (spec 022) defines the visual world.

## Evidence on Hand

Specs `001`–`020` (business truth), 36 migrations, the presentation-contract
ledger (`docs/frontend-presentation-contracts.md` ≈666 E2E expectations),
13+ Playwright suites, unit/db/integration tiers. No testimonials, no
marketing claims — none may be fabricated.

## Product Principles

1. **Server truth wins** — the UI presents; refusals surface verbatim.
2. **One system, consumed** — every surface composes the same tokens and
   primitives; drift is a defect.
3. **Honest states** — loading, empty, error, and disabled are designed, not
   incidental.
4. **Speed for the shift** — staff surfaces optimize scan-and-act density;
   customer surfaces stay comfortable and trustworthy.
5. **Evidence over claims** — behavior is proven by the test tiers.

## Accessibility & Inclusion

WCAG 2.1 AA as the floor: labeled controls, announced errors (`role="alert"`),
polite async feedback (`role="status"`), visible focus everywhere, reduced
motion honored, forced-colors-safe degradation. English-only UI (no i18n
contract).
