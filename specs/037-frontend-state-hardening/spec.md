# specs/037 — State, Error, Loading & Offline Hardening (Master Plan §Frontend Phase 17)

## spec.md

## Clarifications (session 2026-10-08)

- Q: What is the skeleton threshold? → A: ~300 ms — any read expected to exceed
  ~300 ms renders skeletons (menu, lists, boards, reports); faster reads finish
  before skeletons would flash. Dimensions must match the content they replace
  at each breakpoint.
- Q: Are offline actions blocked or hidden? → A: Blocked with a reason — action
  buttons stay visible but disabled with a clear why (offline/stale), plus the
  offline banner. No queue, no optimistic queue-for-retry: the contract
  supports no deferred writes (out of scope) — a hidden button would dishonestly
  suggest full capability.
- Q: What is the refusal-rendering policy? → A: Inline at the action site for
  mutations (RefusalAlert: verbatim server message + context, input preserved);
  page-level for reads (ErrorState with retry). One policy, two placements —
  never a toast as the sole carrier of a refusal.
- Q: Is last-known data shown offline for cashier? → A: Yes — the last-known
  board stays readable with staleness obvious (text as well as color), and
  actions are disabled-with-reason per the offline decision above. Operational
  safety during service outweighs the blank-screen caution.
- Q: What is the read-retry policy? → A: One automatic retry for reads only
  (query-client read-side review), then a manual ErrorState retry. Mutations
  are never auto-retried — a refused write retries only through an explicit
  user action.

### Purpose
The product is used on bad Wi-Fi, against failed reads, refused writes, empty
tenants, partial data, expired sessions, and offline tablets. This phase makes
every surface **honest in every situation that is not the happy path**: "loading /
empty / error" stops being an afterthought and becomes a designed, tested state
vocabulary. Each route records a full state matrix (initial load / background
refetch / empty / partial / read error / mutation in-flight / mutation refused /
forbidden / session expired / offline / reconnected / stale-while-realtime) — each
row maps to a component and a test. This phase **hardens**: no new product
features, no new data reads, no changes to server error semantics, no retry policy
that could duplicate a mutation, and no offline write queue (nothing in the
contract supports deferred writes — none is invented). Every state change must
keep the Phase 15 accessibility suites and the Phase 16 responsive suites green.

### User Stories (prioritized)

#### US1 — A cashier on bad Wi-Fi knows whether their last click reached the server (Priority: P1)
On the operational surfaces (cashier round queue, transitions, void, session
close, kitchen hand-offs), every mutation has honest in-flight discipline: the
button disables while the write is in flight (the double-submit guard's client
half), a refused write renders the server's verbatim refusal at the action site,
and on an offline/reconnecting tablet the last-known data stays readable with
staleness obvious and actions disabled with a reason (clarified: blocked, never
hidden — no queue exists because the contract supports no deferred writes) —
never a phantom success and never a silently dropped action.

**Why this priority**: the cashier is the operational heart during service; a
phantom success or a lost void is real money and real trust.

**Independent Test**: deterministic failure-injection specs — a controlled RPC
refusal during each high-risk action, a controlled delayed response for in-flight
state, and a controlled disconnect/reconnect on the cashier dashboard — all
reproducible on every run.

**Acceptance Scenarios**:
1. **Given** an open session, **When** the round-transition request is in flight,
   **Then** the action is disabled (no duplicate submissions are possible) and the
   UI shows the in-flight state without layout shift.
2. **Given** the backend refuses a mutation, **When** the refusal returns, **Then**
   the exact server message renders at the action site with context, the user's
   input survives, and nothing pretends the write succeeded.
3. **Given** the cashier tablet is offline (injected), **When** the board renders,
   **Then** the last-known data stays readable, staleness is obvious (text as well
   as color), and the action buttons render disabled with the offline reason

#### US2 — An owner sees "no voids this week" instead of a blank box (Priority: P1)
Every read surface has a meaningful empty state that names the next action and is
never mistakable for an error, and every read expected to exceed ~300 ms renders
skeletons (menu, lists, boards, reports) whose dimensions match the content they
replace at each breakpoint — loading never shifts layout.

**Why this priority**: empty and loading states are the most-seen non-happy-path
states across all 25 routes; a blank box reads as a bug.

**Independent Test**: controlled empty-result injection per representative route
asserts the empty state's text and next action; controlled delayed responses
assert skeleton rendering and zero layout shift when content arrives.

**Acceptance Scenarios**:
1. **Given** an empty audit log / empty report week / empty branch list, **When**
   the surface renders, **Then** a designed empty state appears that names the
   next action and is visually distinct from an error state.
2. **Given** a slow read on the customer menu (injected delay), **When** the page
   loads, **Then** skeletons render at the content's final dimensions and the
   swap to content causes no visible layout shift.

#### US3 — A customer whose order submission fails keeps their cart and reads exactly why (Priority: P1)
On the customer path (menu, cart, round submission, status), a failed submission
preserves the cart and the user's input, renders the refusal verbatim with
context, and offers retry only where a retry can help — retry never re-issues a
mutation without explicit user intent, and error copy states what the user can do
in plain language.

**Why this priority**: the customer path is the revenue path; losing a filled cart
to a generic error is the most expensive dishonest state in the product.

**Independent Test**: failure-injection specs around round submission (controlled
RPC refusal, controlled timeout) assert cart survival, verbatim message rendering,
and the recovery path.

**Acceptance Scenarios**:
1. **Given** a filled cart, **When** round submission fails (injected refusal),
   **Then** the cart contents and note survive, the server's exact refusal message
   renders with context, and the user can retry with explicit intent.
2. **Given** a submission that times out (injected), **When** the timeout lands,
   **Then** the UI states honestly that the result is unknown, rather than
   claiming success or failure.

#### US4 — An expired session returns the user somewhere sane with an explanation (Priority: P2)
Session expiry lands on a route-level error-boundaryfallback with a recovery path: the user is returned somewhere sane, told what happened in plain language,
and returned to the attempted surface after re-authentication where the shell
knows the return-to target (the Phase 04 guard behavior carries forward) — no white screen, no
silent redirect, no raw provider error ever rendered.

**Why this priority**: expiry touches every identity, but the recovery is a
shell-level property with one designed fallback — not 25 bespoke pages.

**Independent Test**: a controlled session-expiry injection (401-class response on
a representative read and on a representative mutation) asserts the fallback
route, the explanation copy, and the recovery path.

**Acceptance Scenarios**:
1. **Given** an authenticated user whose session expires mid-read, **When** the
   next request returns the expiry response, **Then** the user lands on the
   designed fallback with an explanation and a working recovery path — never a
   white screen and never a raw error object.
2. **Given** an error thrown inside a route component, **When** the route-level
   boundary catches it, **Then** the fallback renders with a retry that recovers
   the route without a full app reload.

#### US5 — A manager reading a comparison where one branch failed sees the failure, not a zero (Priority: P2)
Multi-call surfaces (reports comparison, multi-branch reads) handle partial
failure honestly: the successful parts render, the failed part is named with its
reason and a per-part retry, and a failed branch is never rendered as zero or as
an empty result.

**Why this priority**: partial failure is the most misleading state class — a
zero reads as "this branch sold nothing", which is a lie with consequences.

**Independent Test**: a controlled partial-failure injection on the comparison
surface (one branch's read fails, others succeed) asserts the
PartialFailureNotice with the failed branch named and the successful parts intact.

**Acceptance Scenarios**:
1. **Given** a multi-branch comparison, **When** one branch's read fails
   (injected), **Then** the other branches render fully, the failed branch shows a
   named partial-failure notice with a retry, and nothing renders as zero.
2. **Given** the failed branch's retry succeeds, **When** it completes, **Then**
   the notice clears and the branch's data renders in place without disturbing
   the other branches.

### Edge Cases
- A refused mutation during a burst (several rapid clicks before disable lands):
  the guard must hold — no duplicate write, one refusal announcement, no
  live-region spam.
- A read error on a live-updating surface (kitchen board, cashier queue): the
  last-known data stays on screen with the error named — the board never blanks
  because a poll failed.
- Reconnect after offline: realtime `SUBSCRIBED` recovery must reconcile without
  phantom announcements or duplicate rows; staleness clears only when data is
  actually fresh.
- Empty state vs zero data vs disabled: "no rounds yet", "round closed with zero
  total", and "you can't access this" are three different states and must never
  share a rendering.
- A refusal whose server message is long or technical: rendered verbatim (the
  contract requires verbatim) but wrapped, with context; never truncated into a
  lie, never overflowing at 320 px (Phase 16 floor).
- Offline banner placement: must not cover primary actions on phones or cover the
  kitchen board's actionable region.
- Error copy at 200 % zoom and mobile widths: the state components must not
  themselves overflow (Phase 16 carry-forward).
- Loading announced politely only when it matters; refusal announcements must not
  spam the live region during a burst (Phase 15 policy carries forward).
- Session expiry during a mutation in flight: the in-flight guard and the expiry
  fallback must compose — no double-handling, no orphaned spinner.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-01**: Every registered route MUST have a recorded state inventory —
  loading / empty / error / partial / forbidden / offline / stale — mapping each
  state to its implemented component and its test, recorded in the phase
  artifacts; no route may be left unclassified.
- **FR-02**: Reads expected to exceed ~300 ms (menu, lists, boards, reports —
  clarified threshold) MUST render skeletons whose
  dimensions match the content they replace at each breakpoint; loading must
  never shift layout.
- **FR-03**: Every read surface MUST have an empty state that names the next
  action and is never visually confusable with an error state.
- **FR-04**: Every error state MUST offer retry where a retry can help, MUST
  preserve the user's input, and MUST offer a safe recovery path; retry MUST
  never re-issue a mutation without explicit user intent. Reads get one
  automatic retry (clarified: reads only, one attempt) before the manual retry
  state renders.
- **FR-05**: Refusal rendering MUST follow one policy — inline at the action
  site for mutations (`RefusalAlert` with the verbatim server message plus
  context), page-level for reads (`ErrorState` with retry) — the clarified
  split — with verbatim server messages plus context; a toast is never the sole
  carrier of a refusal.
- **FR-06**: Mutation in-flight discipline MUST be audited across every action:
  button disabled while in flight plus a submit guard, no duplicate writes.
- **FR-07**: Offline/reconnecting behavior on cashier, kitchen, and session
  oversight MUST keep last-known data readable, make staleness obvious, and
  disable actions with a clear reason (clarified: blocked-with-reason, never
  hidden, no deferred-write queue) — never silently dropped,
  never a phantom success.
- **FR-08**: A route-level error-boundary fallback MUST exist with a recovery
  path; no unhandled error may reach a white screen.
- **FR-09**: Multi-call surfaces (comparison, multi-branch reads) MUST handle
  partial failure honestly — failed parts named with reason and per-part retry,
  never rendered as zero.
- **FR-10**: The session-expiry path MUST return the user somewhere sane with an
  explanation and restore the attempted surface after re-authentication where
  the shell knows the return-to target (the Phase 04 guard behavior carries
  forward).
- **FR-11**: The state vocabulary MUST be documented for future phases (in
  `docs/conventions.md` and the phase artifacts).

### UX Requirements
- States never look like bugs: "nothing yet" vs "couldn't load" vs "you can't
  access this" are visually and verbally distinct everywhere.
- Loading never shifts layout; long-running actions give progressive feedback.
- Error copy is plain-language and states what the user can do; error typography
  reads as guidance, not alarm.
- Nothing pretends to be fresh when it is stale; offline must not silently
  degrade the kitchen board.

### Visual Requirements
- Skeleton, empty, error, offline, forbidden, and partial treatments are a
  consistent visual family of first-class components — not per-page inventions:
  `Skeleton` family, `EmptyState`, `ErrorState`, `RetryButton`,
  `PartialFailureNotice`, `OfflineSurface`, `RefusalAlert`, plus the route-level
  error-boundary fallback.
- Status colors used consistently with the token palette; no new raw hex enters
  with state styling.

### Responsive Requirements (carry-forward)
- State components verified at mobile/tablet/desktop; skeleton dimensions match
  the content they replace at each breakpoint (the committed 640/1024/1440 scale
  and the Phase 16 viewport anchors).
- Offline banner placement never covers primary actions on phones or the kitchen
  board.
- The Phase 16 suites pass unchanged after all state work.

### Accessibility (carry-forward constraints)
- Loading announced politely only when it matters; error states focusable /
  focus-managed and announced; retry reachable by keyboard.
- Empty states are real text, not images of text; offline state is text as well
  as color.
- Refusal announcements do not spam the live region during a burst (the Phase 15
  announcement policy holds unchanged).
- The Phase 15 suites pass unchanged after all state work.

### Security
- Error surfaces must not leak internals: no raw provider errors, no
  SQL/PostgREST messages beyond what the contract surfaces, no stack traces.
- Denial/forbidden states disclose nothing about other tenants.
- Retry logic must never re-issue a mutation without user intent (a refused write
  retries only through an explicit user action).

### Testing (deterministic failure injection only)
- E2E: route-level request failures via Playwright routing (mocked network
  failures), controlled delayed responses, controlled empty results, controlled
  RPC refusals, controlled realtime disconnect/reconnect driven by the test.
- **Forbidden**: manually disconnecting Wi-Fi, random timing, sleep/wait races,
  unreliable network conditions, or any mechanism that amounts to "hope the
  request fails" — every injected failure must produce the same result on every
  run.
- Coverage: offline simulation, slow-response simulation for skeletons,
  duplicate-click protection on high-risk actions (submit round, transitions,
  void, close session, onboarding), refresh-failure for live lists, partial
  comparison failure, session expiry, error-boundary recovery.
- Unit: state-selection helpers. Database/integration suites unchanged.

### Out of scope
No new product features; no new data reads; no changes to server error
semantics; no retry policy that could duplicate a mutation; no offline write
queue (nothing in the contract supports deferred writes — do not invent it); no
new routes; no backend, RPC, or authorization changes; no localization work; no
redesign of states that are already correct (harden, don't redesign).

### Dependencies
Phases 04–14 (all states exist somewhere today); Phase 16 (sequential hardening
chain — responsive suites must stay green); Phase 03 (toast/offline
infrastructure); Phase 01's query-client policy (reviewed here for read-retry
semantics only); Phase 15's announcement policy and suites; the presentation
ledger for any selector migration.

### Success Criteria *(mandatory)*
- **SC-001**: Every route's state matrix is recorded (all twelve state rows) with
  each row mapped to a component and a test — zero unclassified routes.
- **SC-002**: Failure-injection specs pass deterministically (same result every
  run) across refusal, delay, empty, timeout, offline, and reconnect classes.
- **SC-003**: No unhandled error reaches a white screen (route-boundary fallback
  proven for a thrown error and for expiry).
- **SC-004**: Duplicate-submit protection proven on the named high-risk actions;
  zero duplicate writes under injected burst conditions.
- **SC-005**: Partial-failure rendering proven on the comparison surface (failed
  branch named, never zero).
- **SC-006**: The Phase 15 and Phase 16 suites pass unchanged, and the state
  vocabulary is documented in `docs/conventions.md`.

### Assumptions
- Deterministic Playwright routing is the failure-injection engine (clarified in
  the master plan; no network-level chaos tooling).
- The existing `role="alert"` / `role="status"` conventions, the customer's 10 s
  poll, and realtime `SUBSCRIBED` recovery are contracts to preserve, not
  re-derive.
- The verbatim server messages (e.g. `This item is not available here.`, `already
  on its way`, the session-unavailable refusal, `42501` denials) are pinned
  presentation contracts — rendered, never paraphrased.
- The query-client read-retry review may change read-side retry only; mutation
  retry stays manual-only.

### Key Entities (phase artifacts, not runtime data)
- **State matrix table**: per route — the twelve state rows, each mapped to its
  component and test.
- **State vocabulary**: the documented component family and its usage rules in
  `docs/conventions.md`.
- **Failure-injection suite**: the standing Playwright specs per the testing
  section.
- **Migration record**: ledger entries for any presentation contract moved by
  state work.
