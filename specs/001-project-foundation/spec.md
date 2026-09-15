# Feature Specification: Project Foundation (Phase 0)

**Feature Branch**: `001-project-foundation`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "study RestoPilot-Master-Plan.md very well then create specification for phase 0" — Phase 0 as defined in RestoPilot-Master-Plan.md §11 (Project Foundation), constrained by the RestoPilot Constitution and the master plan's architectural rules, feature decomposition (§10), and recommended repository organization (§46).

## Clarifications

### Session 2026-09-15

- Q: Does Phase 0 require the project repository to be hosted on a remote service, or is a locally initialized repository sufficient? → A: GitHub remote — the repository MUST be hosted on GitHub, and the onboarding documentation uses the GitHub clone URL as the starting point of the acceptance gate.
- Q: Must Phase 0 wire the quality pipeline into a hosted continuous-integration service that runs it automatically, or is a locally runnable pipeline sufficient? → A: Local only — the pipeline runs via documented local commands; hosted CI wiring is deferred to a later phase.
- Q: How should the clean-environment acceptance gate be verified before Phase 0 is declared complete? → A: Manual check — a developer performs the documented onboarding on a genuinely clean environment (fresh machine, VM, or fresh user account), following only the documentation, and records pass/fail and elapsed time; no containerized verification harness is required.
- Q: What is the backend environment for Phase 0 — local Supabase or Supabase Cloud? → A: Supabase Cloud — backend services (PostgreSQL, Auth, Realtime, Storage, Edge Functions where needed) run on a configured Supabase Cloud project. Local Supabase/PostgreSQL is NOT a required development workflow (`supabase start` is not used); the Supabase CLI is used only for source-controlled migrations, database type generation, and deployment/synchronization against the configured cloud project.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean-Environment Onboarding (Priority: P1)

A developer (or AI coding agent) with a clean machine and only the documented
prerequisites installed clones the repository from its GitHub remote, follows
the documented onboarding workflow, and ends up with a fully running
development environment: dependencies installed, connectivity to the
configured Supabase Cloud project verified, database migrations applied to the
cloud development database, seed data loaded, frontend application running
locally, and the example test suite passing.

**Why this priority**: This is the master plan's Phase 0 acceptance gate
(§11: clone → install → configure the backend → apply migrations → seed →
start frontend → run tests), executed against the configured Supabase Cloud
project. Every subsequent phase and every other story in this specification
depends on an environment that can be reproduced from scratch.

**Independent Test**: A developer manually follows the documented onboarding
workflow on a genuinely clean environment (fresh machine, virtual machine, or
fresh user account), recording pass/fail per step and total elapsed time; no
containerized verification harness is required.

**Acceptance Scenarios**:

1. **Given** a clean machine with only the documented prerequisite tools
   installed, **When** the developer follows the documented onboarding
   workflow, **Then** dependencies install, connectivity to the configured
   Supabase Cloud project is verified, migrations apply to the cloud
   development database, seed data loads, the frontend starts, and all example
   tests pass.
2. **Given** the repository has just been cloned, **When** the developer reads
   the setup documentation, **Then** all required tools and their versions are
   listed before any setup step is required.
3. **Given** onboarding is complete, **When** the developer opens the frontend
   in a browser, **Then** the application shell loads without errors.

---

### User Story 2 - Reproducible Data-Layer Workflow (Priority: P2)

A developer can reset the development database on the configured Supabase
Cloud project to zero and rebuild it entirely from version-controlled
migrations plus seed data, and can introduce new schema changes through one
canonical, documented workflow that also regenerates the project's data-access
type definitions from the current cloud schema.

**Why this priority**: The master plan makes the database the authoritative
source of business state (§5.1) and mandates migration-based, reproducible
database work (§29), warning explicitly that agents must not invent a second
migration workflow. Phase 1 (Database and Multi-Tenancy) cannot start safely
without this mechanism in place.

**Independent Test**: Run the documented reset command on a database with
applied migrations and local modifications; verify it rebuilds deterministically
from zero. Then follow the documented migration and type-generation steps and
verify they produce versioned, reproducible results.

**Acceptance Scenarios**:

1. **Given** a cloud development database containing applied migrations and
   manual changes, **When** the developer runs the documented reset/rebuild
   workflow, **Then** the database is rebuilt from zero using only repository
   artifacts (migrations and seed data), with a deterministic result.
2. **Given** a new schema change is needed, **When** the developer follows the
   documented migration workflow, **Then** the change is captured as a
   versioned migration that applies cleanly on a database rebuilt from zero.
3. **Given** the database has been rebuilt from migrations, **When** the
   developer runs the documented type-generation step, **Then** data-access
   type definitions are generated from the current schema and are reproducible
   after a full rebuild.
4. **Given** any developer or agent needs to change the database, **When** they
   consult the project documentation, **Then** exactly one canonical workflow
   exists for doing so.

---

### User Story 3 - Quality Pipeline (Priority: P3)

A developer can run the complete quality pipeline — formatting check, linting,
type checking, tests at every configured level, and a production build — through
documented commands, and the pipeline fails loudly and clearly whenever
something is wrong.

**Why this priority**: The master plan requires testing to be part of each
feature rather than a final activity (§40) and never allows correctness to be
traded for polish (§41). The pipeline is the enforcement mechanism that makes
that policy real from the first day of development.

**Independent Test**: From a clean checkout with onboarding complete, run the
documented quality pipeline commands and verify everything passes. Then
introduce a deliberate violation (for example a type error or a failing test)
and verify the pipeline reports failure with a non-zero exit code.

**Acceptance Scenarios**:

1. **Given** a clean checkout with onboarding complete, **When** the developer
   runs the documented quality pipeline, **Then** formatting, linting, type
   checking, all configured test levels, and the production build execute and
   pass.
2. **Given** code that violates the project's formatting, linting, or typing
   rules, **When** the pipeline runs, **Then** it fails with a non-zero exit
   code and a readable error identifying the violation.
3. **Given** a test that fails, **When** the test suite runs, **Then** the
   failure is reported clearly and the suite exits with a non-zero exit code.

---

### User Story 4 - Application Shell and Routing Structure (Priority: P4)

A developer opens the running frontend and finds a minimal application shell
with distinct top-level route areas for the three primary application
experiences — customer ordering, staff dashboard, and super admin — matching
the master plan's baseline routing direction (§38), ready for later phases to
fill in.

**Why this priority**: The shell is the skeleton every subsequent UI feature
hangs on. Establishing the route areas now prevents restructuring later, while
the experiences remain empty placeholders that carry no business behavior.

**Independent Test**: Start the frontend and navigate to each baseline route;
verify each renders a distinct placeholder area inside the shell without
errors, and that the production build preserves the same route structure.

**Acceptance Scenarios**:

1. **Given** the running frontend, **When** the developer opens the
   application root, **Then** the basic application shell renders.
2. **Given** the routing structure, **When** the developer navigates to the
   public restaurant route, the ordering route, the staff dashboard route, and
   the super admin route, **Then** each renders its own distinct area without
   errors.
3. **Given** a completed production build, **When** the built application is
   served, **Then** the same route structure works as in development.

---

### User Story 5 - Project Conventions and Documentation (Priority: P5)

A developer (and any AI coding agent) can read one set of documented
conventions — repository/folder structure, the feature-development workflow,
and the local environment operations — and know exactly where new code goes,
which commands to run, and which process to follow for a new feature.

**Why this priority**: The master plan's risk register (§47, Risks 8–9)
identifies agent scope creep and lost consistency as major risks; explicit,
single-source conventions are the mitigation. This story has the lowest urgency
because it formalizes what the other stories already make true.

**Independent Test**: Using only the repository documentation, a newcomer can
answer: where does a new frontend component, database migration, or test go;
how is the local environment started, reset, and stopped; and what workflow
must a new feature follow.

**Acceptance Scenarios**:

1. **Given** the repository documentation, **When** a developer needs to place
   a new frontend component, database migration, or test, **Then** the folder
   conventions document specifies its location.
2. **Given** the repository documentation, **When** a developer starts a new
   feature, **Then** the documented feature-development workflow
   (specification → clarification → plan → checklist → tasks → analysis →
   implementation → convergence) is described and points to the project's
   specification directory structure.
3. **Given** the repository documentation, **When** the developer needs to
   start, reset, or stop the local environment, **Then** the commands or
   scripts for each action are documented.

---

### Edge Cases

- What happens when a required prerequisite tool is missing or has the wrong
  version? The onboarding documentation lists prerequisites and versions, and
  the tooling fails with an actionable message rather than an obscure
  downstream error.
- What happens when required environment variables are missing? The affected
  tool reports which values are missing and where to configure them; the system
  must never start silently misconfigured.
- What happens when the configured Supabase Cloud project is unreachable
  (network outage, paused project, wrong credentials)? The documentation
  covers diagnosing connectivity and the prerequisites for reaching the cloud
  project.
- What happens when the database is in a partially migrated or unknown state?
  The reset-to-zero workflow (User Story 2) restores a known-good state.
- What happens when tests are run without a reachable, configured Supabase
  Cloud project? The preconditions for each test level are documented, and
  database-dependent tests fail with clear guidance instead of ambiguous
  connection errors.
- What happens when a developer uses a different operating system than the
  original author? Documented commands and scripts work on the team's
  supported platforms, and any platform-specific steps are called out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST be maintained in a single version-controlled
  repository hosted on GitHub, containing the frontend application, database
  artifacts (migrations and seed), tests, feature specifications, and
  documentation.
- **FR-002**: The repository MUST follow documented folder conventions that
  specify where frontend source code, database migrations and seed data, tests
  by level, feature specifications, and project documentation live.
- **FR-003**: The project MUST document its feature-development workflow
  conventions (specification → clarification → plan → checklist → tasks →
  analysis → implementation → convergence) so that every subsequent feature,
  including AI-assisted work, follows the same process.
- **FR-004**: The complete development environment — the frontend application
  running locally, with backend services on the configured Supabase Cloud
  project — MUST be set up from a clean machine using only the repository
  contents and its documentation.
- **FR-005**: The onboarding documentation MUST list all prerequisite tools and
  versions, and MUST cover the complete acceptance-gate sequence: install →
  configure the connection to the Supabase Cloud project → apply migrations →
  load seed data → start frontend → run tests.
- **FR-006**: Environment configuration MUST be template-driven: the repository
  MUST include a committed template listing all required environment variables,
  actual secret-bearing files MUST be excluded from version control, and no
  privileged credentials MUST ever be exposed to frontend code (Constitution
  Principle IV/V alignment; master plan §5.5).
- **FR-007**: Database schema changes MUST be expressed as version-controlled
  migrations, and the cloud development database MUST be resettable to zero and
  fully rebuilt from migrations plus seed data, deterministically.
- **FR-008**: The project MUST define a seed data strategy for local
  development that loads through the documented workflow; a minimal baseline
  seed sufficient to prove the pipeline is acceptable for Phase 0.
- **FR-009**: The project MUST provide a documented type-generation step that
  produces data-access type definitions from the current schema of the
  configured Supabase Cloud project, and those definitions MUST be
  reproducible after a full database rebuild.
- **FR-010**: Exactly one canonical, documented workflow MUST exist for making
  database changes; the project MUST NOT accumulate parallel ad-hoc migration
  practices.
- **FR-011**: The repository MUST contain a runnable frontend application that
  provides a basic shell (root layout) with distinct top-level areas for the
  customer ordering experience, the staff dashboard, and the super admin area.
- **FR-012**: The routing structure MUST include the master plan's baseline
  routes (§38): a public restaurant route, a branch ordering route, a staff
  dashboard route, and a super admin route.
- **FR-013**: The project MUST include automated test tooling supporting unit
  tests, database-level tests, and end-to-end tests, with at least one passing
  example test of each kind.
- **FR-014**: The project MUST include automated formatting, linting, and type
  checking configured to the project's conventions and runnable through
  documented commands.
- **FR-015**: The full quality pipeline (formatting check, lint, type check,
  all test levels, production build) MUST be executable from a clean checkout
  via documented commands, and MUST fail with a non-zero exit code when any
  check or test fails.
- **FR-016**: Missing or invalid required configuration MUST produce a clear,
  actionable failure message; the system MUST NOT continue in a silently
  misconfigured state.
- **FR-017**: The Phase 0 baseline infrastructure database object MUST use a
  deny-by-default access posture: it MUST NOT be accessible to public or
  client-side access unless explicitly allowed by an approved requirement
  (Constitution Principles III/IV posture; the enforcement mechanism is chosen
  by the technical plan).

### Out of Scope

The following are explicitly out of scope for Phase 0 and belong to later
phases per the master plan (§10, §42):

- Business/domain database schema, tenant model, RLS policies, and audit
  foundation (Phase 1).
- Authentication, roles, session persistence, and route guards (Phase 2).
- Restaurant, branch, menu, ordering, or any business UI functionality beyond
  placeholder route areas (Phases 3+).
- Realtime, reports, subscriptions, super admin functionality (later phases).
- Security hardening, performance work, and production deployment/hosting
  (final phases).
- Hosted continuous-integration wiring — the quality pipeline runs locally in
  Phase 0 (deferred to a later phase).

This boundary also enforces Constitution Principle VIII (Minimal and
Intentional Complexity): Phase 0 builds the baseline only, with no speculative
infrastructure beyond what later phases already require.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new developer, starting from a clean machine with only the
  documented prerequisites, completes the full onboarding (clone → install →
  configure the connection to the Supabase Cloud project → apply migrations →
  seed → start frontend → run tests) in 30
  minutes or less using only the repository's documentation.
- **SC-002**: 100% of the documented onboarding steps succeed as written on a
  clean environment, with zero undocumented manual fixes required.
- **SC-003**: A full database reset-and-rebuild from zero completes
  successfully and deterministically — running it twice produces an equivalent
  known-good state.
- **SC-004**: The complete quality pipeline passes from a clean checkout via
  the documented commands, and correctly reports failure when a violation is
  deliberately introduced.
- **SC-005**: The production build completes successfully and produces a
  deployable application artifact that serves the baseline route structure.
- **SC-006**: No secret or privileged credential is present in version control
  after setup, and the committed environment template contains no real secret
  values.

## Assumptions

- The technology stack is not chosen by this specification. The approved
  RestoPilot Master Plan fixes the technology direction (§4.2: frontend
  framework, backend platform, and test frameworks); exact choices and
  versions are finalized in the technical plan for this feature.
- Phase 0 is a technical baseline only: no business features, no business data
  model beyond a minimal baseline proving the pipeline, and no authentication
  are included.
- The backend services (PostgreSQL, Auth, Realtime, Storage, and Edge
  Functions where needed) run on a configured Supabase Cloud project. Local
  Supabase/PostgreSQL is NOT a required development workflow (no
  `supabase start`); the Supabase CLI is used only for source-controlled
  migrations, database type generation, and deployment/synchronization
  against the cloud project.
- The quality pipeline runs locally via documented commands; wiring it into a
  hosted continuous-integration service is deferred to a later phase and is
  not part of Phase 0.
- The team develops on Windows (at minimum); documented commands and scripts
  must run on the team's actual operating systems, with platform-specific
  steps called out.
- Seed data in Phase 0 is a minimal baseline that proves the mechanism;
  meaningful domain seed data arrives with the features that own those
  domains.
- The repository is not yet under version control at the time this
  specification was written; initializing it and hosting it on GitHub is part
  of this feature's work (FR-001), and the branch/feature directory naming
  follows the master plan's feature decomposition (§10).
