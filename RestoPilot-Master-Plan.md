# RestoPilot — Master Project Plan

**Document type:** Master implementation roadmap  
**Status:** Planning baseline  
**Version:** 1.0.0  
**Date:** 2026-09-15  
**Primary product source:** `RestoPilot.md`  
**Governing principles:** `.specify/memory/constitution.md`

---

## 1. Purpose

This document is the **master execution plan** for RestoPilot.

It defines:

- the implementation phases;
- the dependency order between phases;
- the technical architecture direction;
- the Supabase strategy;
- the main data domains;
- the security model;
- the realtime approach;
- the testing strategy;
- the release gates;
- how the project should be decomposed into Spec Kit feature specifications.

This document does **not** replace feature specifications.

The feature specifications remain the source of detailed product behavior, acceptance criteria, edge cases, and user stories.

The Constitution remains the highest-level project authority.

---

# 2. Project Definition

RestoPilot is a multi-tenant SaaS **Order Collection Layer** for restaurants.

It allows customers to browse a restaurant menu and submit orders without creating a customer account, while restaurant staff manage those orders through operational dashboards.

The system is explicitly **not a POS**.

The external POS remains responsible for:

- payment collection;
- accounting;
- printing;
- internal inventory management.

RestoPilot is responsible for:

- customer ordering;
- sessions;
- rounds;
- kitchen tickets;
- cashier/kitchen workflows;
- menu availability;
- taxes as a presentation/calculation layer;
- operational dashboards;
- realtime order state;
- audit and void records;
- restaurant/branch/staff management;
- basic operational reporting;
- subscription administration.

---

# 3. Product Scope Baseline

## 3.1 V1 scope

V1 includes:

- guest customer ordering;
- dine-in sessions;
- delivery sessions;
- takeaway sessions;
- rounds;
- kitchen tickets;
- cashier dashboard;
- kitchen dashboard;
- owner dashboard;
- branch manager dashboard;
- super admin dashboard;
- menu management;
- categories;
- items;
- structured extras;
- item availability;
- branch management;
- tables;
- restaurant-level QR;
- working hours;
- dynamic tax configuration;
- session pricing lock;
- realtime updates;
- audit logging;
- void logging;
- basic reports;
- multi-tenancy;
- manual subscription administration.

## 3.2 Explicitly out of scope

Do not implement these as part of the current roadmap:

- online payment;
- accounting;
- invoice printing;
- internal inventory management;
- bill splitting logic;
- customer accounts;
- WhatsApp notifications;
- SMS notifications;
- discounts/coupons;
- dynamic QR;
- native customer mobile app;
- POS integrations.

These may be future work only through an explicit scope change.

---

# 4. Architecture Direction

## 4.1 High-level architecture

```text
                           RestoPilot Web App
                                  |
             +--------------------+--------------------+
             |                    |                    |
        Customer App         Staff Dashboard      Super Admin
             |                    |                    |
             +--------------------+--------------------+
                                  |
                           Supabase Client
                                  |
              +-------------------+-------------------+
              |                   |                   |
             Auth              Realtime          Data/API
              |                   |                   |
              +-------------------+-------------------+
                                  |
                            PostgreSQL
                                  |
              +-------------------+-------------------+
              |                   |                   |
             RLS            DB Functions        Edge Functions
              |                   |                   |
              +-------------------+-------------------+
                                  |
                             Storage
```

## 4.2 Initial technology direction

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Supabase JS
- CSS/component system chosen during the first technical plan

The final library list must stay intentionally small.

### Backend

- Supabase PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage where required
- Supabase Edge Functions only for trusted server-side/external-integration operations
- PostgreSQL functions/triggers where transactional database logic is the better boundary

### Testing

- Vitest for unit/domain tests
- Playwright for end-to-end tests
- database-level tests for security and invariant validation
- type checking and production build checks

### Hosting

- Web frontend: Cloudflare Pages or equivalent static hosting
- Backend/database: Supabase
- Edge Functions: Supabase

The final deployment provider contract must be recorded in the first production plan.

---

# 5. Architectural Rules

These are implementation directions derived from the Constitution and the product requirements.

## 5.1 Database is authoritative

The database is the source of truth for persistent business state.

Client state may be used for:

- optimistic UI;
- cart recovery;
- caching;
- temporary form state.

Client state must never become the authoritative business state.

## 5.2 Authorization is backend-enforced

The UI may hide actions.

The backend/database must actually prevent unauthorized operations.

RLS is the primary data-access security boundary for exposed Supabase data.

Business-critical write operations should be implemented so that validation and authorization cannot be bypassed by calling the database/API directly.

## 5.3 Transactions for business-critical mutations

Operations involving multiple related records must preserve atomicity.

Examples:

- creating a round and its line items;
- creating a kitchen ticket for a round;
- closing a session;
- recording a void;
- applying a price/tax snapshot;
- sensitive multi-row status transitions.

## 5.4 Realtime is not the source of truth

Realtime is a delivery mechanism for state changes.

If a client misses an event, reconnect/reload must recover the correct state from the database.

## 5.5 Server/client separation

Never expose:

- service-role credentials;
- secret API keys;
- privileged database credentials.

in browser code.

---

# 6. Domain Model Direction

The final schema will be created and refined during the database phase.

The main domain groups are:

## 6.1 Identity and tenancy

- profiles
- restaurants
- branches
- staff memberships/assignments
- role data
- organization/tenant settings

## 6.2 Restaurant configuration

- restaurant settings
- branch settings
- working hours
- tables
- restaurant QR configuration
- subscription state

## 6.3 Menu

- menus
- categories
- items
- item extras
- item availability
- branch overrides
- price/version records where required

## 6.4 Tax

- tax rules
- scope definitions
- ordering
- branch overrides
- calculation metadata/snapshots where required

## 6.5 Ordering

- sessions
- session participants
- customer session identity/token data
- cart recovery data if persisted
- rounds
- round items
- round item extras

## 6.6 Kitchen

- kitchen tickets
- ticket items
- preparation state

## 6.7 Operational traceability

- audit logs
- void logs
- notifications/events if required

## 6.8 SaaS administration

- subscription records
- subscription history
- super-admin actions

The exact table names, columns, indexes, foreign keys, constraints, and functions belong to the database feature plan.

---

# 7. Core Business Concepts

These concepts must remain distinct in the implementation.

## 7.1 Restaurant

Top-level tenant.

A restaurant owns branches, staff scope, configuration, menus/tax defaults, and subscription state.

## 7.2 Branch

Operational boundary under a restaurant.

Orders, sessions, tables, staff operations, and branch-level overrides are isolated by branch.

## 7.3 Session

The primary customer ordering container.

A session can contain multiple rounds.

Session types:

- dine-in;
- delivery;
- takeaway.

## 7.4 Round

Each customer submission creates a new round.

A session can therefore contain:

```text
Session
  ├── Round 1
  ├── Round 2
  └── Round 3
```

## 7.5 Kitchen Ticket

A separate operational representation of a round for the kitchen.

Kitchen tickets must represent the newly submitted items and must not cause previously submitted items to be sent to the kitchen again.

## 7.6 Menu Item

An orderable product with:

- name;
- description;
- price;
- optional image;
- category;
- structured extras;
- availability state.

## 7.7 Extra

A structured option attached to an item.

Extras are selectable values, not arbitrary customer-written text.

---

# 8. State Management Strategy

The project contains several independent state machines.

They must be specified and implemented separately.

## 8.1 Session state

At minimum:

```text
OPEN
CLOSED
```

No automatic session timeout.

## 8.2 Round state

At minimum:

```text
NEW
ACCEPTED
PREPARING
READY
LOCK
```

The exact legal transitions and actor permissions are defined in the ordering/kitchen specifications.

## 8.3 Delivery lifecycle

At minimum, the operational flow includes:

```text
NEW
→ ACCEPTED
→ PREPARING
→ READY
→ OUT_FOR_DELIVERY
→ COMPLETED
```

The cutoff that prevents additional orders is tied to the delivery workflow.

## 8.4 Takeaway lifecycle

The cutoff is tied to the item being ready for pickup.

## 8.5 Subscription state

Subscription state and restaurant operational state must remain separate.

An expired subscription does not automatically disable ordering.

---

# 9. Spec Kit Project Strategy

The project must be implemented as multiple feature specs, not as a single giant specification.

Spec Kit's current workflow supports:

```text
constitution
→ specify
→ clarify
→ plan
→ checklist
→ tasks
→ analyze
→ implement
→ converge
```

For production features, the quality gates should be used by default.

Large features should be implemented in stages rather than giving one implementation command an enormous scope.

Each feature should preserve its own history in its feature directory.

---

# 10. Feature Decomposition

Recommended feature sequence:

```text
001-project-foundation
002-database-and-tenancy
003-auth-and-rbac
004-restaurant-and-branch-management
005-menu-management
006-tax-engine
007-customer-access-and-session
008-cart-and-rounds
009-kitchen-and-cashier-operations
010-delivery-and-takeaway
011-bill-void-and-audit
012-realtime-and-notifications
013-reports
014-super-admin-and-subscriptions
015-security-hardening
016-production-readiness
```

Some of these may be split further if a generated specification becomes too large.

---

# 11. Phase 0 — Project Foundation

## Goal

Create a clean technical baseline before business features are implemented.

## Main outcomes

- repository structure;
- frontend application;
- Supabase local development;
- migrations folder;
- environment strategy;
- generated database types;
- test tooling;
- lint/typecheck/build pipeline;
- Spec Kit project conventions;
- basic routing shell.

## Work

1. Initialize/verify repository.
2. Configure React + TypeScript + Vite.
3. Initialize Supabase local development.
4. Configure migrations.
5. Configure seed data strategy.
6. Configure generated database types.
7. Configure environment variables.
8. Configure testing.
9. Configure lint/format/type checking.
10. Build basic application shell.
11. Build basic route structure.
12. Establish folder conventions.
13. Document local development workflow.

## Acceptance gate

The project can be:

```text
clone
→ install
→ start Supabase
→ apply migrations
→ seed
→ start frontend
→ run tests
```

from a clean environment.

---

# 12. Phase 1 — Database and Multi-Tenancy

## Goal

Build the authoritative domain data layer and tenant isolation.

## Main outcomes

- restaurant model;
- branch model;
- users/profiles;
- staff membership/roles;
- tables;
- core foreign keys;
- indexes;
- constraints;
- RLS foundation;
- database helper functions;
- audit foundation.

## Critical requirements

Every tenant-owned record must have a deterministic ownership path back to the restaurant.

Branch-scoped records must also have a deterministic branch path.

## Required security tests

Test that:

- restaurant A cannot read restaurant B;
- branch A cannot read branch B;
- staff cannot bypass tenant scope;
- direct API/database access still respects authorization.

## Exit condition

Database can be reset from zero and recreated entirely from migrations.

---

# 13. Phase 2 — Auth and RBAC

## Goal

Implement authenticated staff access and authorization boundaries.

## Roles

```text
Super Admin
Owner
Branch Manager
Cashier
Kitchen
Customer
```

Customer is a guest ordering participant, not a normal staff account.

## Main outcomes

- staff login;
- staff logout;
- session persistence;
- password recovery;
- role mapping;
- restaurant/branch scope;
- route guards;
- database RLS policies;
- authorization helpers.

## Supabase direction

Supabase Auth handles authenticated staff identities.

RBAC may use database-backed role membership and, where justified, custom claims/access-token hooks.

Claims should not become a replacement for database authorization; they should support the authorization model.

## Exit condition

Each staff role can sign in and only access the intended scope.

---

# 14. Phase 3 — Restaurant and Branch Management

## Goal

Let the owner configure the restaurant and its branches.

## Features

### Restaurant

- restaurant profile;
- brand information;
- basic settings.

### Branch

- create/edit branch;
- working hours;
- branch settings;
- staff assignment;
- tables;
- branch-level configuration.

### Tables

- create table;
- rename/number table;
- activate/deactivate table;
- associate table with branch.

### QR

One restaurant-level QR is the V1 customer entry point.

The customer selects the table in the ordering flow.

## Exit condition

An owner can create a restaurant, branch, tables, and staff and see the correct scoped dashboard.

---

# 15. Phase 4 — Menu Management

## Goal

Create the complete menu management domain.

## Features

- categories;
- items;
- descriptions;
- images;
- prices;
- extras;
- item availability;
- branch menu behavior;
- shared restaurant menu;
- branch override strategy.

## Availability

Each item can be marked available/unavailable by authorized staff.

The customer menu must reflect availability quickly through realtime updates.

## Price handling

Price changes must follow the approved pricing policy.

The session/order system must not simply read the latest menu price after a session has been established.

## Exit condition

Owner/branch manager can maintain the menu and customer menu reflects the current published availability.

---

# 16. Phase 5 — Tax Engine

## Goal

Implement centralized, deterministic tax calculation.

## Features

Tax can apply at:

- total level;
- item level;
- group/category level.

Support:

- normal subtotal calculation;
- compound calculation;
- explicit calculation ordering;
- restaurant defaults;
- branch overrides;
- customer-visible tax lines.

## Architecture

Create one canonical tax calculation domain.

The tax engine should not be duplicated independently in multiple UI pages.

Use shared domain logic and persisted snapshots when required to preserve historical correctness.

## Test matrix

Cover:

- no taxes;
- one subtotal tax;
- multiple taxes;
- compound taxes;
- item-level taxes;
- group-level taxes;
- mixed scopes;
- branch overrides;
- ordering changes.

---

# 17. Phase 6 — Customer Access and Sessions

## Goal

Implement the customer entry point and secure session model.

## Customer flow

```text
Restaurant QR / public restaurant route
        ↓
Restaurant page
        ↓
Select branch if required
        ↓
Select table for dine-in
        ↓
Enter customer name + phone
        ↓
Validate/create session context
        ↓
Browse menu
```

## Session rules

### Dine-in

First valid customer interaction opens a session.

Other customers using the same restaurant/table flow can join the active session.

### Closed session

If the table receives a new session after the old session is closed, previous customer devices must be redirected/reassociated according to the approved session design.

### No timeout

The session does not close because of inactivity.

The cashier/authorized operational user controls the close action.

## Security

The session access mechanism must prevent arbitrary external users from accessing another customer's active session.

The exact token/anonymous identity mechanism must be finalized during this phase's technical plan.

## Exit condition

A real customer can enter securely, create/join a session, and recover it without creating a normal account.

---

# 18. Phase 7 — Cart and Rounds

## Goal

Implement the core ordering engine.

## Cart

Use:

```text
LocalStorage
+
server-side session recovery
```

The local cart is optimized for immediate recovery.

The server-side representation is the recovery/source mechanism for the active session.

No cart should be persisted for a customer who has not entered an active session.

## Round creation

When the customer submits a cart:

1. validate the session;
2. validate current item availability;
3. validate item/extras;
4. apply the correct price snapshot;
5. calculate required taxes;
6. create the round;
7. create its items/extras;
8. create the kitchen ticket;
9. commit the transaction;
10. emit/update realtime state.

## Critical transaction

Round submission must not result in:

- partially created rounds;
- missing items;
- missing kitchen ticket;
- invalid extras;
- unavailable newly submitted items.

## Exit condition

A customer can submit Round 1 and Round 2 into the same session without duplicating previous kitchen work.

---

# 19. Phase 8 — Kitchen and Cashier Operations

## Goal

Implement operational dashboards.

## Cashier

The cashier can:

- view live incoming rounds;
- accept rounds;
- modify orders;
- remove items;
- record required voids;
- mark item unavailable;
- close sessions;
- view aggregated bill information;
- add a round manually where the product specification allows it.

Owner and branch manager may perform operational actions within their allowed scope.

When they act operationally, the action must be traceable as required by the audit rules.

## Kitchen

Kitchen can:

- see relevant kitchen tickets;
- start preparation;
- mark ready.

Kitchen cannot:

- manage stock;
- perform cashier operations;
- change menu availability unless explicitly added in a future scope change.

## Kitchen ticket requirement

Each round creates a separate kitchen ticket for the new items only.

## Exit condition

A new customer round appears to the cashier and kitchen in realtime and moves through the approved state flow.

---

# 20. Phase 9 — Delivery and Takeaway

## Goal

Reuse the same ordering/session infrastructure for non-dine-in channels.

## Delivery

Customer supplies:

- name;
- phone;
- delivery address.

Session starts with first order.

The session becomes locked for additional orders at the approved delivery cutoff.

## Takeaway

Same basic architecture with the pickup cutoff.

## Principle

Do not create a completely separate order engine for delivery and takeaway.

Reuse:

- sessions;
- rounds;
- pricing;
- tax;
- kitchen;
- cashier;
- audit.

Only channel-specific behavior should vary.

---

# 21. Phase 10 — Bill, Void, and Audit

## Goal

Finish the operational accounting-display boundary without becoming a POS.

## Bill

Show:

- subtotal;
- item totals;
- extras;
- taxes;
- final total;
- optional per-person visibility.

The system does not process payment.

The POS remains responsible for actual payment and printing.

## Edit

Cashier can edit/remove order items according to the approved rule.

Normal edits do not require a mandatory reason.

The edit is still auditable.

## Void

A post-billing void requires:

- authorized cashier-level permission;
- mandatory reason;
- separate void record.

## Audit

Audit should capture at minimum:

- actor;
- timestamp;
- operation;
- target record;
- relevant change/reason.

Exact retention and payload belong to the feature specification.

---

# 22. Phase 11 — Realtime and In-App Notifications

## Goal

Make operational workflows live.

## Realtime domains

- menu availability;
- incoming rounds;
- round state changes;
- kitchen ticket state;
- session state;
- customer order status;
- operational notifications.

## Design principles

1. Database write succeeds first.
2. Realtime communicates the new state.
3. Clients can recover missed events by refetching authoritative state.
4. Realtime channels must be scoped to authorized restaurant/branch/session context.

## Security

Private realtime access must be protected through the appropriate Realtime authorization model and RLS where applicable.

Public channels should not be used for private restaurant operational data.

## Exit condition

Open clients see authorized state changes without manual refresh while reconnecting safely after network interruptions.

---

# 23. Phase 12 — Reports

## Goal

Add basic operational reporting without becoming a financial/accounting system.

## Owner reports

- daily;
- weekly;
- monthly;
- best-selling items;
- branch comparison;
- channel breakdown;
- void log;
- audit log.

## Branch manager

Same reporting domain limited to their branch.

## Cashier

No financial reporting dashboard.

## Kitchen

No reporting dashboard.

## Architecture

Reports should be generated from normalized persisted data.

Avoid maintaining multiple independent "report totals" that can drift from source records.

Use database views/materialized strategies only when justified by measured performance needs.

---

# 24. Phase 13 — Super Admin and Subscriptions

## Goal

Implement SaaS-level administration.

## Super Admin

Can:

- view all restaurants;
- view subscription state;
- manually activate subscriptions;
- manually change subscription dates;
- see basic platform usage;
- manually disable restaurants if required.

## Subscription lifecycle

Support:

- active;
- nearing expiration;
- expired;
- manually disabled.

## Important rule

Expiration does not automatically disable ordering.

The platform owner makes that decision manually.

## Reminder

Generate an in-app warning before expiration according to the approved timing.

---

# 25. Phase 14 — Security Hardening

## Goal

Perform an explicit security review after the major business flows exist.

## Review areas

### Tenant isolation

Attempt unauthorized access across:

- restaurants;
- branches;
- staff roles;
- customer sessions.

### Role bypass

Attempt operations as:

- cashier;
- kitchen;
- branch manager;
- owner.

### Client bypass

Call APIs/functions directly instead of using the UI.

### Session abuse

Test:

- guessed session IDs;
- reused tokens;
- expired tokens;
- cross-session access;
- cross-table access.

### Input validation

Test:

- invalid quantities;
- invalid item IDs;
- unavailable items;
- invalid extras;
- invalid status transitions;
- oversized text;
- malformed customer data.

### Secrets

Verify no privileged credentials are present in frontend bundles or public environment variables.

### Audit integrity

Ensure users cannot edit/delete audit records through normal application permissions.

## Exit condition

Security test suite passes and no known critical authorization bypass remains.

---

# 26. Phase 15 — Performance and Reliability

## Goal

Make the system operationally stable before launch.

## Areas

- menu loading;
- dashboard queries;
- realtime fan-out;
- session retrieval;
- round submission;
- kitchen ticket updates;
- report query performance;
- image handling;
- reconnection behavior.

## Performance priorities

Customer menu and order submission receive higher priority than deep analytics pages.

Do not optimize prematurely before baseline measurements exist.

## Reliability tests

Test:

- refresh during active session;
- network interruption;
- realtime disconnect;
- duplicate submit;
- double-click;
- stale tab;
- concurrent cashiers;
- simultaneous customer actions.

---

# 27. Phase 16 — End-to-End Validation

## Goal

Validate the complete restaurant workflow from a customer perspective.

## Main happy path

```text
Owner creates restaurant
        ↓
Creates branch
        ↓
Creates tables
        ↓
Creates menu
        ↓
Customer scans QR
        ↓
Selects table
        ↓
Enters name + phone
        ↓
Session opens
        ↓
Customer places Round 1
        ↓
Cashier receives round
        ↓
Cashier accepts
        ↓
Kitchen receives ticket
        ↓
Kitchen prepares
        ↓
Kitchen marks ready
        ↓
Customer sees updated state
        ↓
Customer places Round 2
        ↓
Second kitchen ticket
        ↓
Customer requests/view bill
        ↓
Cashier closes session
        ↓
Session becomes closed
```

## Additional scenarios

Test:

- two customers sharing a table;
- closed session followed by a new session;
- unavailable item during ordering;
- price change before a new session;
- price change while an old session remains open;
- tax changes;
- branch overrides;
- delivery cutoff;
- takeaway cutoff;
- void;
- unauthorized branch access;
- multiple restaurant tenants.

---

# 28. Phase 17 — Production Readiness

## Environments

Maintain at least:

```text
Local
Staging
Production
```

Production data must never be used casually as development/test data.

## Deployment

### Frontend

Build and deploy the production web application.

### Supabase

Use migration-based deployment.

Never treat manual dashboard schema edits as the normal production workflow.

## Production checklist

- environment variables;
- Supabase URLs;
- Auth redirect URLs;
- RLS enabled;
- policies deployed;
- Realtime configuration;
- storage policies;
- Edge Functions;
- custom domain;
- HTTPS;
- backups;
- logging/monitoring;
- error tracking;
- seed/demo strategy;
- admin access.

---

# 29. Recommended Supabase Development Workflow

Use the Supabase CLI and repository migrations as the normal workflow.

Expected lifecycle:

```text
Change planned
   ↓
Migration created
   ↓
Local Supabase tested
   ↓
DB tests
   ↓
Frontend integration
   ↓
Staging
   ↓
Production migration
```

Useful commands will be established in the foundation phase, typically around:

```text
supabase start
supabase migration new <name>
supabase db reset
supabase db push
supabase gen types typescript ...
```

Do not let individual agents invent a second migration workflow.

---

# 30. Supabase RLS Strategy

RLS should be treated as a first-class architecture concern.

## Restaurant-scoped records

Policy logic should determine the restaurant belonging to the authenticated staff member.

## Branch-scoped records

Policy logic should additionally determine the user's branch scope.

## Owner

Can access the restaurant and all branches in that restaurant.

## Branch manager

Can access only the assigned branch.

## Cashier

Can access only operational data required for the assigned branch.

## Kitchen

Can access only kitchen operational data required for the assigned branch.

## Customer

Customer access should not simply receive unrestricted access to all anonymous rows.

The customer session security model must be designed explicitly in its own feature plan.

---

# 31. Supabase Function Strategy

Use PostgreSQL functions when the main purpose is:

- transactional database logic;
- multi-row state changes;
- data integrity;
- database-side invariant enforcement.

Use Edge Functions when the main purpose is:

- server-side trusted logic;
- external integrations;
- secret-bearing operations;
- webhooks;
- orchestration around external services.

Do not move every operation into Edge Functions by default.

Do not put complex business integrity logic only in browser code.

---

# 32. Realtime Strategy

Prefer persisted database state plus realtime notifications.

For each realtime domain decide:

1. what table/data changes;
2. who is allowed to receive it;
3. which channel/scope is used;
4. how a reconnecting client catches up;
5. whether Postgres Changes, Broadcast, or another Realtime mechanism is appropriate.

Realtime should be introduced incrementally rather than turned on for every table without access design.

---

# 33. Image and Storage Strategy

Menu images can use Supabase Storage.

Requirements:

- restaurant/tenant scoped paths;
- controlled upload permissions;
- controlled public/private access;
- cleanup of replaced images;
- file-type/size validation.

Image storage implementation belongs to the menu feature plan.

---

# 34. API / Contract Strategy

Prefer direct Supabase access for simple authorized CRUD where appropriate.

Use database functions or Edge Functions for operations that require:

- transactions;
- multiple related writes;
- sensitive authorization;
- trusted processing;
- external calls.

All high-risk operations should have explicit contracts.

Examples:

- create round;
- close session;
- create void;
- change order state;
- create subscription activation.

The exact contracts should live in feature `contracts/` artifacts when needed.

---

# 35. Data Integrity Requirements

The implementation must guard against:

## Duplicate submissions

A customer double-click must not create duplicate rounds.

## Duplicate kitchen tickets

One round must not produce multiple equivalent kitchen tickets.

## Invalid extras

An extra must belong to the selected item.

## Unavailable item ordering

New order submission must not accept an item that is unavailable according to the approved rule.

## Cross-branch references

A branch must not reference another branch's menu/table/session data where the business model forbids it.

## Stale price

Existing sessions must retain the correct price behavior according to the session-lock policy.

## Invalid state transition

A status update must fail when the transition is not legal.

---

# 36. Concurrency Requirements

Because multiple staff and customers can act simultaneously, concurrency is a first-class requirement.

Test and design for:

- two customers adding rounds simultaneously;
- cashier accepting while customer changes state;
- kitchen updating while cashier edits;
- two cashiers editing the same round;
- availability changed while customer submits;
- session close racing with new round submission.

The final technical plan must identify where row locking, optimistic concurrency, idempotency keys, timestamps, or other mechanisms are required.

Do not add concurrency mechanisms blindly; select them per operation.

---

# 37. Audit Strategy

Audit is a product capability, not just a debug log.

At minimum, sensitive actions need:

```text
actor
timestamp
action
resource
change/reason
scope
```

Examples include:

- operational action by owner/manager;
- order edit;
- void;
- price change;
- availability change;
- important configuration change;
- subscription action.

Audit retention, indexing, and search/filter UI should be specified during the audit/report phase.

---

# 38. UI Architecture Direction

There are three primary application experiences:

```text
Customer
Staff Dashboard
Super Admin
```

Use shared domain components where appropriate, but do not force all experiences into one giant page component.

Recommended high-level routing:

```text
/r/:restaurantSlug
/order/:branchId
/dashboard
/admin
```

Within authenticated areas, views should be role-aware.

Navigation visibility is a UX concern; authorization remains a backend concern.

---

# 39. Frontend State Strategy

Use separate categories of state:

### Server state

Use a query/cache system for:

- menus;
- sessions;
- rounds;
- kitchen tickets;
- reports;
- restaurant data.

### UI state

For:

- dialogs;
- filters;
- tabs;
- temporary selections.

### Local customer cart

Use LocalStorage for fast recovery.

### Realtime

Use realtime events to invalidate/update relevant server state rather than creating a second client-side database.

---

# 40. Testing Strategy

Testing is part of each feature rather than a final-only activity.

## Unit tests

For:

- tax calculation;
- pricing behavior;
- state transitions;
- validation rules;
- utility/domain functions.

## Database tests

For:

- RLS;
- tenant isolation;
- role permissions;
- constraints;
- transactional functions;
- critical invariants.

## Integration tests

For:

- round creation;
- kitchen ticket creation;
- session close;
- void;
- subscription updates.

## E2E tests

For complete user stories across customer and staff workflows.

---

# 41. Test Priority Order

When time is constrained, prioritize:

1. security and tenant isolation;
2. session correctness;
3. order/round correctness;
4. kitchen ticket correctness;
5. price/tax correctness;
6. role authorization;
7. realtime correctness;
8. dashboard UX;
9. secondary reporting.

The system must never trade correctness of ordering/security for visual polish.

---

# 42. Phase Dependencies

```text
Foundation
    ↓
Database + Tenancy
    ↓
Auth + RBAC
    ↓
Restaurant/Branch Management
    ↓
Menu
    ↓
Tax
    ↓
Customer Session
    ↓
Cart + Rounds
    ↓
Kitchen + Cashier
    ├──────────────→ Delivery/Takeaway
    ↓
Bill/Void/Audit
    ↓
Realtime
    ↓
Reports
    ↓
Super Admin/Subscriptions
    ↓
Security Hardening
    ↓
Performance/Reliability
    ↓
E2E Validation
    ↓
Production
```

## Safe parallel work

After foundational architecture exists, some work can run in parallel:

- restaurant/branch UI;
- menu UI;
- auth screens;
- dashboard shell;
- design system;
- automated test infrastructure.

Parallel work must not modify conflicting core files or contradict the approved plan.

---

# 43. Spec Kit Execution Gate Per Feature

Every substantial feature should use:

```text
/speckit.specify
        ↓
/speckit.clarify
        ↓
/speckit.plan
        ↓
/speckit.checklist
        ↓
/speckit.tasks
        ↓
/speckit.analyze
        ↓
/speckit.implement
        ↓
/speckit.converge
```

## Specify

Describe:

- what;
- why;
- users;
- user stories;
- acceptance criteria;
- business rules.

Do not start by dumping implementation details into the specification.

## Clarify

Resolve real ambiguities before planning.

## Plan

Define:

- technology choices;
- architecture;
- schema;
- contracts;
- file structure;
- technical constraints;
- implementation strategy.

## Checklist

Use it to review requirement quality and completeness.

## Tasks

Generate dependency-aware implementation tasks.

## Analyze

Require a clean or consciously reviewed consistency analysis before implementation.

## Implement

Implement in stages when the feature is large.

## Converge

Verify code against:

- spec;
- plan;
- tasks;
- constitution.

If gaps are found, complete them before declaring the feature done.

---

# 44. Phase Completion Gate

A phase is complete only when:

1. its approved feature spec exists;
2. its plan is approved;
3. its checklist has been reviewed;
4. tasks are complete or explicitly deferred;
5. tests pass;
6. `/speckit.analyze` has no unresolved critical contradiction;
7. `/speckit.converge` reports convergence or remaining tasks have been completed and convergence rerun;
8. the code builds successfully;
9. security boundaries relevant to the phase are verified;
10. no unrequested scope has been introduced.

---

# 45. Definition of Done — Project

RestoPilot is ready for initial production use when:

## Product

- all V1 scope is implemented;
- out-of-scope features remain out of the product;
- customer ordering works;
- staff workflows work;
- reports work within defined scope;
- Super Admin subscription management works.

## Backend

- migrations are reproducible;
- RLS is enabled and tested;
- critical mutations are transactional;
- tenant isolation is verified;
- realtime access is secured.

## Frontend

- customer experience works on mobile;
- dashboard works on desktop/tablet;
- role-based navigation works;
- error/loading/empty states exist;
- reconnect/recovery flows work.

## Quality

- critical unit tests pass;
- database security tests pass;
- E2E happy paths pass;
- main edge cases pass;
- production build passes.

## Operations

- production environment is documented;
- deployment is reproducible;
- migration process is documented;
- backups/monitoring are configured;
- secrets are safely managed.

---

# 46. Recommended Repository Organization

High-level direction:

```text
/
├── .specify/
│   └── memory/
│       └── constitution.md
│
├── specs/
│   ├── 001-project-foundation/
│   ├── 002-database-and-tenancy/
│   ├── 003-auth-and-rbac/
│   ├── ...
│
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── hooks/
│   ├── routes/
│   └── types/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── seed.sql
│   └── config.toml
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── database/
│
├── e2e/
│
├── docs/
│
├── package.json
└── ...
```

The exact structure can be refined in Phase 0 without changing the architectural responsibilities.

---

# 47. Major Risks

## Risk 1 — Overloading one feature spec

Mitigation:

Split by domain and business capability.

## Risk 2 — Weak RLS design

Mitigation:

Design tenant and role access before building business UI and test it directly.

## Risk 3 — Business logic in frontend

Mitigation:

Move critical validation/state transitions into trusted backend/database boundaries.

## Risk 4 — Realtime becomes a second state system

Mitigation:

Database remains authoritative; reconnect means refetching authoritative state.

## Risk 5 — Session security becomes an afterthought

Mitigation:

Make customer session security its own feature with dedicated abuse tests.

## Risk 6 — Price/tax drift

Mitigation:

Centralize calculation rules and preserve required snapshots.

## Risk 7 — Concurrent actions corrupt order state

Mitigation:

Define transaction/idempotency/concurrency behavior in the relevant plans.

## Risk 8 — AI agent scope creep

Mitigation:

Constitution + feature specs + checklists + analyze + converge.

## Risk 9 — Giant implementation context

Mitigation:

Implement one phase/feature at a time and use Spec Kit's staged implementation flow.

---

# 48. Recommended Implementation Order for the First Production Milestone

The first milestone should target one fully working operational slice:

```text
Restaurant
→ Branch
→ Staff login
→ Tables
→ Menu
→ Customer QR
→ Session
→ Round
→ Kitchen Ticket
→ Cashier
→ Kitchen
→ Realtime
→ Bill view
→ Session close
```

Then add:

```text
Delivery
Takeaway
Reports
Super Admin
Subscriptions
Hardening
```

This creates a usable end-to-end restaurant workflow before expanding peripheral functionality.

---

# 49. Master Execution Strategy

The project should be treated as a sequence of verified vertical slices rather than a large frontend-first build.

For every slice:

```text
Business intent
      ↓
Feature specification
      ↓
Ambiguity resolution
      ↓
Technical plan
      ↓
Requirement checklist
      ↓
Tasks
      ↓
Consistency analysis
      ↓
Implementation
      ↓
Tests
      ↓
Convergence
      ↓
Accepted phase
```

No phase should be marked complete solely because its UI exists.

The phase is complete when the required behavior, data model, security, tests, and integration all agree with the approved artifacts.

---

# 50. Immediate Next Action

The next artifact to create from this master plan is:

```text
001-project-foundation
```

Run the Spec Kit workflow for the foundation feature first.

After that is accepted, proceed to:

```text
002-database-and-tenancy
```

The detailed database schema should **not** be designed in this master document. It belongs in the plan generated for the database/tenancy feature, where the coding agent can reason from the current specification and the project's actual Supabase setup.

---

# 51. Reference Notes

This plan intentionally separates concerns:

```text
constitution.md
    = non-negotiable project principles

RestoPilot.md
    = product/business source of truth

master-plan.md
    = roadmap + architecture direction + phase dependencies

spec.md
    = exact feature requirements

plan.md
    = technical implementation design for that feature

tasks.md
    = executable work breakdown

code/tests
    = implementation + verification
```

When these artifacts disagree:

1. Constitution governs project-wide principles.
2. Approved feature requirements define product behavior.
3. Approved plans define technical implementation.
4. Tasks define execution order.
5. Code must converge back to the approved artifacts.

