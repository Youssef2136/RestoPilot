<!--
Sync Impact Report
- Version change: (unratified template scaffold) → 1.0.0
- Modified principles: none (initial ratification)
- Added sections: Intro/Purpose, Core Principles (I–VIII), Scope, Versioning,
  Governance (Authority, Amendments, Compliance, Precedence)
- Removed sections: none
- Follow-up TODOs: none
-->

# RestoPilot Constitution

This Constitution defines the non-negotiable principles that govern the design,
specification, implementation, and evolution of RestoPilot.

## Core Principles

### I. Business Scope Integrity

RestoPilot is an **Order Collection Layer**, not a POS system.

The system MUST NOT introduce or assume responsibility for:

- financial accounting
- payment processing
- invoice printing
- inventory management

unless the project scope is explicitly amended.

The external POS remains responsible for financial collection, printing,
accounting, and internal inventory operations.

### II. Specifications Are the Source of Business Truth

Business behavior MUST be explicitly defined in approved specifications.

Implementations MUST NOT invent, infer, or silently change business rules that
are not defined by the current specifications.

When implementation details are unclear, the ambiguity MUST be resolved through
the specification process rather than by arbitrary agent decisions.

### III. Multi-Tenant Isolation

RestoPilot MUST enforce strict tenant isolation.

Data and operations MUST remain within the authorized restaurant and, where
applicable, branch scope.

No implementation may rely solely on frontend visibility or navigation
restrictions to provide tenant or role isolation.

### IV. Server-Enforced Authorization

Security-sensitive authorization MUST be enforced on the trusted
backend/database layer.

Frontend role checks MAY control presentation and user experience, but MUST NOT
be treated as the final authorization boundary.

Every protected operation MUST be validated against the authenticated user's
effective permissions and scope.

### V. Database as the Source of Truth

Persistent business state MUST have a single authoritative source in the backend
data layer.

Frontend state, local storage, caches, realtime messages, and other client-side
mechanisms MAY improve responsiveness or recovery, but MUST NOT become an
independent source of truth for business-critical state.

Business-critical mutations MUST preserve data integrity and MUST NOT depend on
client-side enforcement alone.

### VI. Explicit State and Data Integrity

Business-critical state transitions MUST be explicit, validated, and consistent.

Implementations MUST prevent invalid transitions, contradictory state, and
partial updates that could leave business data inconsistent.

The detailed states, transitions, and workflows belong to the relevant feature
specifications.

### VII. Auditability of Sensitive Operations

Sensitive operational actions that require traceability MUST leave a reliable
record of who performed the action and when, together with the relevant change
or reason where required by the specification.

Auditability MUST NOT be implemented only as client-side logging or user-visible
history.

The exact events, fields, and retention rules belong to the relevant
specifications and plans.

### VIII. Minimal and Intentional Complexity

The implementation MUST solve the approved requirements without introducing
unnecessary product scope or architectural complexity.

Agents and developers MUST NOT add features, integrations, abstractions, or
infrastructure merely because they may be useful in the future.

YAGNI applies unless a requirement or architectural decision explicitly
justifies the additional complexity.

## Scope

This Constitution is intentionally limited to project-wide rules. Feature
requirements, business workflows, database schemas, API contracts, UI details,
and implementation plans belong in their respective specifications and plans.

RestoPilot operates as an Order Collection Layer in front of an external POS
system; the product scope boundary is defined in Principle I.

## Versioning

This Constitution follows semantic versioning:

- **MAJOR** — incompatible change to project principles or governance.
- **MINOR** — addition of a new principle or materially expanded governance rule.
- **PATCH** — clarification or wording change that does not alter the intended
  rules.

## Governance

### Authority

This Constitution is the highest-level development authority for RestoPilot.

Approved specifications, plans, and tasks MUST comply with its principles.

When a lower-level artifact conflicts with this Constitution, the conflicting
artifact MUST be revised or the Constitution MUST be formally amended.

### Amendments

Changes to the Constitution MUST be intentional, explicit, and versioned.

An amendment MUST:

1. State the principle being added, removed, or changed.
2. Explain the reason for the change.
3. Update the Constitution version.
4. Trigger a review of affected specifications and plans.

### Compliance

Every feature plan SHOULD be checked against the Constitution before
implementation.

Critical violations of a MUST principle MUST be resolved before the affected
feature is considered complete.

### Precedence

When multiple project documents conflict, use this order of authority:

1. Constitution
2. Approved feature specifications
3. Approved implementation plans
4. Tasks and implementation details
5. Informal notes or assumptions

**Version**: 1.0.0 | **Ratified**: 2026-09-15 | **Last Amended**: 2026-09-15
