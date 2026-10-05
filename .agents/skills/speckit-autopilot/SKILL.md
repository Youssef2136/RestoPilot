---
name: "speckit-autopilot"
description: "Autonomously run the SpecKit feature pipeline — specify, clarify, plan, checklist, tasks, analyze, implement, analyze, converge — by inspecting project state, deciding the next step, dispatching each step to a Speckit-Specialist subagent, verifying every result, and looping until the requested scope is complete. Use when the user asks to run, continue, resume, or automate any SpecKit phase or the whole workflow — e.g. 'run the speckit workflow', 'autopilot the next feature', 'continue the spec pipeline', 'take feature 003 to converged' — or invokes $speckit-autopilot."
compatibility: "Requires the speckit-* skill suite under .zcode/skills/ and a Spec Kit project structure (.specify/ directory)"
---

# SpecKit Autopilot

You are the **manager** of a SpecKit feature pipeline, acting as the project owner. The dedicated **Speckit-Specialist subagent** is the worker. This split keeps the main context lightweight: the specialist holds the heavy skill instructions and feature artifacts in its own context; you hold the state machine, the review decisions, and the conversation with the user.

## Input

Parse the user's request into three things:

1. **Target feature** — a named feature directory (`specs/003-...`), "the active feature", or "a new feature". Default: the `feature_directory` in `.specify/feature.json`.
2. **Requested scope** — one step ("run clarify"), a milestone ("through tasks"), or the full pipeline ("to converged"). Default: full pipeline from the current state.
3. **Preferences to pass through** — feature description, checklist focus, or other decisions the user already made. Never re-ask these.

If the user is only asking where the project stands ("what phase are we in?"), run state inspection and report — do not dispatch anything.

## Division of labor

You (manager) — never delegate:

- Inspect state and decide which SpecKit operation runs next, as an exact $speckit-* command
- Dispatch the Speckit-Specialist with that exact command in a self-contained, correctly scoped prompt
- Review every result and verify it against on-disk artifacts
- Run the repair loop when a result is wrong or incomplete
- Decide when a human decision is required and ask the user
- Control phase progression and report progress

Specialist (worker — always the dedicated Speckit-Specialist subagent) — never do yourself:

- Execute the dispatched $speckit-* skill/command, using its own skill instructions
- Write or edit feature artifacts (spec.md, plan.md, tasks.md, checklists, application code)
- Run setup/prerequisite scripts

The specialist never decides the next SpecKit operation, phase, or overall workflow — it executes exactly the dispatched command, returns the structured result, and stops.

Exception: you may read files and run cheap read-only commands (`ls`, `grep`, `git status`, the project's test command) for state inspection and verification. That is review, not execution — when verification fails, dispatch a repair instead of fixing it yourself.

## The pipeline

```
specify → clarify → plan → checklist → tasks → analyze → implement → analyze → converge
                                                                       │
                                        converge appended tasks ──────┘
                                          → implement → converge   (max 3 rounds)
```

Steps run strictly in order. Never skip a step, and never skip its verification. `converge` appends a `Phase N: Convergence` section to tasks.md when gaps remain; that loops back through `implement` and `converge`. If gaps persist after 3 convergence rounds, stop and report to the user — persistent gaps signal a systematic problem that needs human judgment.

Out of scope: `speckit-constitution` and `speckit-taskstoissues` run only on explicit request. Do not invent steps beyond this pipeline.

## Step 1: Inspect state

Determine the next step from disk, not from memory:

| Disk state (in FEATURE_DIR unless noted) | Next step |
|---|---|
| No feature directory, or no spec.md | specify (requires a feature description from the user) |
| spec.md contains `[NEEDS CLARIFICATION` | clarify — resolve the markers through the user first |
| spec.md exists, no `## Clarifications` session recorded | clarify |
| spec.md solid, no plan.md | plan |
| plan.md exists, no custom checklist (only `checklists/requirements.md`) | checklist |
| Custom checklist exists, no tasks.md | tasks |
| tasks.md exists, has unchecked `- [ ]` tasks, implementation not started | analyze (pre-implement) |
| Analysis has no CRITICAL findings, tasks.md has unchecked tasks | implement |
| All tasks `[X]`, post-implement analysis not yet run | analyze (post-implement) |
| Post-implement analysis done, converge not yet run | converge |
| Convergence phase exists with unchecked tasks | implement (convergence round) |
| converge reports converged | done — final report |

Notes:

- The active feature comes from `.specify/feature.json`. If it is missing or ambiguous (several features with incomplete artifacts), ask the user which one to target.
- Within one session you know which steps you already ran. On a fresh session, if you cannot tell whether post-implement analyze or converge already ran, just run them — both are safe (analyze is read-only; converge only appends when it finds real gaps).
- State the determined step and requested scope back to the user in one line before dispatching.

Before dispatching any step, read that step's section in `references/phase-guide.md` — it holds the entry criteria, step-specific dispatch constraints, the verification checklist, and common failure modes.

## Step 2: Dispatch the specialist

One SpecKit operation per dispatch, via the Agent tool with `subagent_type: "Speckit-Specialist"`. The dispatch always names the exact SpecKit skill/command — never a bare step name. The state table's steps map to the supported commands:

- specify → `$speckit-specify`
- clarify → `$speckit-clarify`
- plan → `$speckit-plan`
- checklist → `$speckit-checklist`
- tasks → `$speckit-tasks`
- analyze → `$speckit-analyze`
- implement → `$speckit-implement`
- converge → `$speckit-converge`

The prompt's Skeleton must be:

```text
1.Execute: $speckit-<skill>
```

The result block is your review input: it tells you where to look, not what to conclude.

## Step 3: Verify

- Trust artifacts, not narratives. After every dispatch, confirm the step's exit criteria by checking the files yourself — existence, checkbox counts, format greps, a test run, `git status`. The per-step checklists in `references/phase-guide.md` are deliberately cheap.
- A step is complete only when its exit criteria hold. Never advance, and never tell the user a step is done, on the specialist's word alone.
- Keep verification proportional: you are checking that the work landed and is structurally sound, not re-doing it. Deep correctness is what `analyze` and `converge` exist for.

## Repair loop

When the specialist returns FAILED or PARTIAL, or your verification fails:

1. Resume the same specialist: `SendMessage(to: <agentId>)` listing the specific defects — what to fix, where, and what evidence should change. Resuming preserves its context of work already done.
2. If the agent cannot be resumed, dispatch a fresh specialist with the original prompt plus the defects and a summary of what is already done, so it does not redo finished work.
3. Re-verify after each repair. After 3 failed repair rounds, stop and report the gap to the user with the evidence.

When the specialist returns NEEDS_INPUT, resolve the question through the user (next section), then resume the specialist with the answer — do not restart the step.

## Human decision gates

Ask the user (AskUserQuestion, max 4 questions per call, batch related ones) when:

- The feature description is missing — specify cannot start without it, and you must never invent one
- A skill produced explicit questions: specify's `[NEEDS CLARIFICATION]` markers (max 3), clarify's question queue (max 5)
- Custom checklists have unchecked items at the implement gate — those checkboxes are reviewer-owned; approving them is the user's call
- A finding forces a choice between materially different product behavior, scope, or architecture (conflicting requirements in analyze, code removal in converge)
- The same step has failed 3 repair rounds

Always present the specialist's recommendation as the first option, marked "(Recommended)", so the user can simply accept it.

Do not ask when the skill documents a default (checklist focus/depth/audience all have defaults — use them and note it), when the artifacts already constrain the technical detail, or when the user answered earlier in this session.

After the user answers, resume exactly where the pipeline stopped. Do not restart the step or redo completed work — pass the answer to the waiting specialist or fold it into the next dispatch.

## Reporting

- One line per completed step, e.g. `✅ clarify — 4 answers encoded, requirements checklist 12/16 → 15/16`.
- Report failures honestly: what failed, what you tried, what remains.
- At the scope boundary, give a final summary: steps run, artifacts produced, task counts (total/complete), test status, convergence rounds, and any open items for the user.
- Do not commit unless the user asked for commits. If they did, commit at step boundaries following the repo's convention (e.g. `feat(003): ...`).
