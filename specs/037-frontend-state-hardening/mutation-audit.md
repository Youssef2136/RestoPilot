# specs/037 — Mutation In-Flight Audit (FR-06 / T005)

Method: every site calling `.mutate(`/`.mutateAsync(` outside tests was walked
(grep over `src/features/`, `src/routes/`, `src/components/`); each was checked
for the disabled-while-in-flight discipline (button disabled/busy + guard) and
for its refusal rendering. Result per site:

| Site | Mutations | In-flight discipline | Refusal rendering | Verdict |
|---|---|---|---|---|
| `order/components/SubmitControl.tsx` | submitRound | disabled = empty-cart ‖ isPending + label swap | RefusalAlert (037 adoption) | OK — fixed |
| `order/components/SubmitBar.tsx` | submitRound | same guard family | RefusalAlert (037 adoption) | OK — fixed |
| `routes/CashierRoundsPage.tsx` | accept/startPrep/ready/lock/outForDelivery/completed/modify/voidRound (8) | aggregate `busy` gates every card action (`RoundCard` disables + checkbox) | `RefusalText` per-round (`data-refusal` pinned anchor, verbatim) | OK — pre-existing |
| `routes/KitchenDashboardPage.tsx` | start/ready transitions | `busy` = start ‖ ready | per-round `refusalFor()` verbatim on the card | OK — pre-existing |
| `routes/PlatformConsolePage.tsx` | dates mutation ×2 sites | disabled = isPending ‖ datesInvalid | RefusalAlert (037 adoption) + ConfirmDialog/inline error | OK — fixed |
| `session/components/RestaurantEntry.tsx` | enterSession/enterChannelSession | disabled = pending ('Joining…') | RefusalAlert (037 adoption) | OK — fixed |
| `session/components/BranchSessionsPanel.tsx` | closeMutation | ConfirmDialog busy + label swap | ConfirmDialog `error` prop (verbatim) | OK — pre-existing |
| `tax/components/SnapshotAction.tsx` | record snapshot | disabled = isPending ‖ empty-label ‖ no-branch | RefusalAlert (037 adoption; once-only outcome stays a status) | OK — fixed |
| `tax/components/TaxRulesPanel.tsx` / `BranchTaxPanel.tsx` | rule CRUD | setSaving discipline | inline danger Alert | OK — pre-existing |
| `management/components/*` (MenuStructurePanel, MenuItemEditor, ExtrasEditor, AvailabilityControls, StaffManagementPanel, WorkingHoursEditor, ItemImageField) | CRUD + availability | setSaving/setBusy discipline | inline danger alerts / toasts per surface contract | OK — pre-existing |
| `platform/components/OnboardingPanel.tsx` | onboardRestaurant | disabled = submitting | RefusalAlert (037 adoption; success keeps status) | OK — fixed |
| `auth` pages (ChangePassword, Admin) | password/admin ops | setBusy discipline | inline alerts | OK — pre-existing |

Gaps fixed this phase: the six bare-`<p role="alert">` mutation refusal sites
now render the `RefusalAlert` vocabulary component (verbatim text preserved —
every pinned E2E text assertion survives; the change is presentational).

Zero duplicate-write paths found: no site issues a second mutation while one is
in flight, and no retry call re-issues a write (mutation retries are manual-only
by absence of any auto-retry on mutations — the query-client policy leaves
`retry` off the mutation side).

## T012 addendum — the customer failure path (FR-04/FR-05)

The customer round submission surface was re-walked for the clarified refusal
split and the timeout honesty posture. Findings (post-conditions, not new
code): `submitRound` (orderClient) already (a) leaves the cart untouched on a
refusal — the clear runs only on `ok: true`; (b) throws the mapped verbatim
message, which renders inline through `RefusalAlert` in SubmitControl/SubmitBar;
(c) re-enables the send button after the refusal settles (no stranded state,
retry only by an explicit click); and (d) folds a network timeout/abort into
`kind: 'retry'` — the SESSION_RETRY_MESSAGE unknown-result honesty line, never
a fabricated success. No delta required; the T013 E2E pins these behaviors
under deterministic injection.
