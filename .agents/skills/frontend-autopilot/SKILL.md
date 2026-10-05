---
name: frontend-autopilot
description: Autopilot for executing frontend Master Plan phases with SpecKit and Impeccable.
---

# My Skill

Purpose

Execute exactly one frontend phase from the approved Frontend Master Plan from inspection through implementation, design review, validation, convergence, checkpoint, and report.

The user should normally only need to say:

start phase <N>

resume phase <N>

status

report phase <N>

diagnose phase <N>

pause

This skill is an orchestrator, not a replacement for SpecKit or Impeccable.

Source of Truth

Use this precedence:

Explicit user instruction

Approved Frontend Master Plan

Existing approved project/spec artifacts

Existing application/backend contracts

Existing tests and E2E coverage

SpecKit analysis

Impeccable recommendations

Implementation judgment

Never invent product requirements or silently change the Master Plan.

Phase Isolation

Only execute the requested phase.

Do not implement future phases unless explicitly required by the current phase.

Do not modify production data, weaken security, expose secrets, commit .env, or push to remote automatically.

Protect existing Supabase/Auth/RLS/RPC contracts. If the frontend needs an unauthorized backend change, mark the phase BLOCKED instead of changing the backend.

Never reset, discard, or stash unrelated user changes automatically.

Workflow

Run this sequence, skipping only stages that are genuinely unnecessary and recording why:

INIT
→ INSPECT
→ PREREQUISITE_CHECK
→ SPECIFY
→ CLARIFY
→ PLAN
→ DESIGN
→ CHECKLIST
→ TASKS
→ ANALYZE
→ IMPLEMENT
→ CRITIQUE
→ AUDIT
→ FIX
→ VALIDATE
→ CONVERGE
→ CHECKPOINT
→ REPORT
→ DONE

If something fails:

CURRENT_STAGE
→ DIAGNOSE
→ SAFE_FIX
→ TARGETED_VALIDATE
→ CURRENT_STAGE / CONVERGE

Use bounded retries. Never loop indefinitely.

Start Phase

For start phase N:

Locate and read the Frontend Master Plan.

Identify Phase N objective, requirements, dependencies, deliverables, and validation gates.

Inspect the repository and current frontend state.

Check prerequisites and existing work.

Run the SpecKit workflow needed for the phase.

Use Impeccable for frontend/design quality work.

Implement only the approved phase.

Run targeted validation after meaningful changes.

Run the phase's final validation gates.

Fix findings and converge.

Create a Git checkpoint only if allowed by project instructions.

Persist state and write the phase report.

Resume

For resume phase N:

Load saved state.

Verify the repository has not drifted unexpectedly.

Preserve valid completed work.

Resume from the last safe stage/task.

Do not repeat expensive completed work unless evidence is stale or invalid.

If state is missing, reconstruct it from existing artifacts and Git status before continuing.

Inspection

At the beginning of a phase inspect only what is relevant:

Git status/branch/HEAD

package manager and scripts

frontend structure and routes

components and design system

styling/tokens/fonts/icons

Supabase client/types/contracts

tests and E2E

existing SpecKit artifacts

existing Impeccable capabilities/configuration

Record the baseline before changing files.

SpecKit

Use the actual SpecKit commands/capabilities available in the environment. Never invent command names.

Logical sequence:

specify → clarify → plan → checklist → analyze → tasks → analyze

Reuse valid existing artifacts instead of regenerating them unnecessarily.

The plan must identify, where applicable:

routes

components

state/data flow

backend contracts used

responsive behavior

accessibility

loading/empty/error states

testing strategy

design strategy

Classify backend impact as:

NOT_REQUIRED
ALREADY_SUPPORTED
EXPLICITLY_AUTHORIZED
BLOCKING_CONTRACT_GAP

Impeccable

Use the actual installed Impeccable capabilities. Never invent commands.

Use it to inspect and improve:

visual hierarchy

typography

spacing

layout

interaction clarity

consistency

responsive behavior

accessibility

loading/empty/error states

visual polish

Do not blindly apply recommendations. Validate them against the Master Plan, product requirements, existing design system, and technical constraints.

Implementation

Prefer existing project patterns and components.

Keep changes focused on the current phase.

Use the smallest sensible dependency set.

After meaningful implementation steps, run targeted checks.

Do not refactor unrelated code merely for aesthetics.

Quality Gates

Before declaring completion, verify all applicable requirements and gates:

phase requirements satisfied

required tasks complete

typecheck passes

lint/format passes when configured

unit/integration tests pass when applicable

E2E passes when applicable

production build passes when required

responsive behavior checked

accessibility checked

design/UX audit completed

no unresolved CRITICAL/HIGH findings

Use the project's canonical verification command when one exists.

Never claim PASS, DONE, or CONVERGED without evidence.

Findings

Classify findings:

CRITICAL
HIGH
MEDIUM
LOW

CRITICAL/HIGH findings must be fixed before completion unless an explicit blocker prevents it.

MEDIUM/LOW findings may remain only when they do not violate current requirements and are recorded in the report.

Recovery

Classify failures as:

CODE
TEST
CONFIGURATION
ENVIRONMENT
DEPENDENCY
CONTRACT
PRODUCT_AMBIGUITY
EXTERNAL

Automatically fix only deterministic, safe issues.

Ask the user when the issue requires:

product decisions

destructive actions

security exceptions

unauthorized backend changes

missing credentials/configuration

irreversible external actions

Persistent State

Store state under:

.specify/frontend-autopilot/
├── state.json
├── logs/
└── phases/phase-<N>/
    ├── baseline.md
    ├── decisions.md
    ├── findings.md
    ├── validation.md
    └── report.md

Minimum state:

{
  "phase": 0,
  "status": "running",
  "stage": "IMPLEMENT",
  "currentTask": null,
  "completedTasks": [],
  "failedTasks": [],
  "convergenceRound": 0,
  "blocked": false,
  "blocker": null,
  "git": { "baseline": null, "checkpoint": null },
  "validation": { "lastTargeted": null, "final": null },
  "updatedAt": null
}

Never store secrets in state.

Update state after every meaningful stage/task boundary so interrupted runs can resume safely.

Report

Always create:

.specify/frontend-autopilot/phases/phase-<N>/report.md

Keep it concise but evidence-based. Include:

final status

objective

requirements/tasks completed

implementation summary

design/Impeccable findings

files changed

routes/components changed

backend contracts used

accessibility/responsive results

tests/build/E2E results

fixes and convergence rounds

Git checkpoint

remaining warnings

blocked items

traceability from requirement → implementation → validation

Git

Before a checkpoint:

inspect the diff

verify intended files

check for secrets

confirm validation

If project instructions permit commits, create a focused commit such as:

feat(frontend-phase-<N>): <phase-name>

Do not push unless explicitly instructed.

If no commit is appropriate, record that fact instead of pretending a checkpoint exists.

Token Efficiency

Optimize for low token/tool usage:

inspect narrowly

reuse existing artifacts

avoid repeating successful checks

use targeted validation after fixes

run expensive full validation only at phase gates

keep specialist prompts short

persist findings instead of rediscovering them

Human Intervention

Do not ask unnecessary questions.

Continue autonomously unless there is a genuine ambiguity, blocker, destructive action, unauthorized contract change, missing required configuration, or irreversible external action.

When blocked, report:

what is blocked

why

evidence

exactly what decision/input is required

Completion

A phase is complete only when:

requirements satisfied
+ implementation complete
+ required validation passed
+ critical/high findings resolved
+ state persisted
+ report generated
+ checkpoint verified or explicitly marked N/A

Final response should be concise and report:

status

what changed

validation results

checkpoint

warnings/blockers

report path

First Run

For start phase 0, do not assume anything about the frontend.

First inspect the repository and Master Plan, establish the baseline, determine Phase 0 prerequisites, then execute the workflow above.

Never skip inspection just because the phase number is known.