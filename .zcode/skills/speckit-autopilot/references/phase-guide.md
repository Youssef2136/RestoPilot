# Phase Guide

Read your step's section before dispatching. The dispatch prompt skeleton lives in
SKILL.md; each section below supplies the `<step-specific scope and constraints>`
(block 3 of the skeleton), the human gates, and the verification checklist you run
after the specialist returns.

Throughout, `FD` = the feature directory (e.g. `specs/002-database-and-tenancy`).

---

## Step 1 — specify (command: $speckit-specify)

**Runs when**: the target feature has no spec.md, or the user starts a new feature.

**Human gate (before dispatch)**: specify needs a feature description as $ARGUMENTS.
If the user did not provide one, ask for it — never invent or pull one silently from a
planning doc without confirming. If the user says "the next feature from the master
plan", quote the candidate description back and get a yes before dispatching.

**Dispatch constraints**:
- $ARGUMENTS: the feature description, verbatim from the user.
- The specialist creates the feature directory, spec.md, and `checklists/requirements.md`,
  and runs the spec quality validation loop.
- `[NEEDS CLARIFICATION]` option tables are questions for the user. The specialist must
  leave the markers in the spec and return them as NEEDS_INPUT.

**Verify**:
- `.specify/feature.json` points at the new feature directory; `FD/spec.md` exists.
- `grep -c "NEEDS CLARIFICATION" FD/spec.md` → expect 0. Any hits → human gate with the
  specialist's option tables, then dispatch a repair to encode the answers and re-validate.
- Spot-check spec.md for unfilled template placeholders (TODO, TKTK, instructions text).
- `FD/checklists/requirements.md` exists and its checkboxes are all `[x]` per the
  specialist's validation; if not, the specialist should already have looped (max 3
  iterations) — anything still unchecked is a repair or a user gate.

**Pass when**: all of the above hold. **Next**: clarify.

---

## Step 2 — clarify (command: $speckit-clarify) — two dispatches

The clarify skill is interactive by design (one question at a time). A subagent cannot
talk to the user, so this step runs in two passes: scan, then encode.

**Runs when**: spec.md exists and has no `## Clarifications` session (or leftover
`[NEEDS CLARIFICATION]` markers).

**Dispatch A (scan — no file changes)**:
- $ARGUMENTS: none.
- Constraints: execute the skill's setup and ambiguity scan (its steps 1–4). Produce the
  prioritized question queue (max 5) in the skill's question format — full interrogative,
  "why it matters" line, recommended option with reasoning, option table. Do NOT run the
  interactive loop and do NOT modify any file. If no critical ambiguities exist, say so.

**Between passes (manager)**: ask the user all questions via AskUserQuestion — max 4 per
call, so split 5 questions into two calls. Recommended option first and marked
"(Recommended)". If the scan found no critical ambiguities, report that and skip to pass
criteria — the step is complete.

**Dispatch B (encode)**:
- $ARGUMENTS: the accepted answers, as a numbered `Q: … → A: …` list.
- Constraints: execute the skill's integration and validation steps (its steps 5–9) with
  these answers — update the affected spec sections, add the `## Clarifications` /
  `### Session YYYY-MM-DD` block, remove any invalidated contradictory text, re-validate
  `checklists/requirements.md` checkbox states.

**Verify**:
- `grep -A2 "## Clarifications" FD/spec.md` shows a session block with one bullet per
  accepted answer.
- Spot-check the sections the specialist lists as touched: the clarified point is now
  stated plainly, no contradictory leftover text.
- requirements.md: the specialist reports before/after counts; any regression
  (checked → unchecked) is a repair.

**Pass when**: answers encoded, no contradictions, no regressions. **Next**: plan.

---

## Step 3 — plan (command: $speckit-plan)

**Runs when**: spec.md is complete but plan.md is missing.

**Dispatch constraints**:
- $ARGUMENTS: none.
- The specialist runs `.specify/scripts/powershell/setup-plan.ps1`, fills plan.md, and
  generates research.md, data-model.md, contracts/ (when the project has external
  interfaces), and quickstart.md. All `NEEDS CLARIFICATION` unknowns must be resolved
  through research, not left in the artifacts.
- The constitution check must pass. A gate failure is a FAILED result with the specific
  violation quoted — constitution principles are never weakened to make a gate pass.

**Human gates**: architecture or stack choices the specialist flags as genuinely open —
no reasonable default, materially different implications. These come back as NEEDS_INPUT
with options. After the user answers, resume the specialist with the decision.

**Verify**:
- `FD/plan.md`, `FD/research.md`, `FD/data-model.md`, `FD/quickstart.md` all exist and are
  substantive (not template shells).
- `grep -c "NEEDS CLARIFICATION" FD/plan.md` → 0.
- plan.md contains a constitution check section and it passes.

**Pass when**: all artifacts present, no unresolved unknowns, gates pass.
**Next**: checklist.

---

## Step 4 — checklist (command: $speckit-checklist)

**Runs when**: plan.md exists and `FD/checklists/` contains no custom checklist
(`requirements.md` is built-in and does not count).

**Dispatch constraints**:
- $ARGUMENTS: the user's checklist preferences if they stated any this session; otherwise none.
- The skill asks dynamic intent questions, but it documents defaults for exactly this
  situation (Depth: Standard, Audience: Reviewer, Focus: top-2 relevance clusters).
  Instruct the specialist to use those defaults instead of asking, unless the user gave
  preferences. Note the defaults used in your progress line.

**Verify**:
- A new `FD/checklists/<domain>.md` exists with `CHK###`-numbered, unchecked items.
- Spot-check item quality: they test the *requirements* ("Is X quantified…", "Are error
  cases for Y defined…"), not the implementation ("Verify the button works" is wrong).
- Most items carry a traceability reference (`[Spec §FR-…]`, `[Gap]`, …).

Autopilot never checks checklist boxes — custom checklists are reviewer-owned. Unchecked
items are handled at the implement gate (Step 7).

**Pass when**: file exists, format and quality spot-checks pass. **Next**: tasks.

---

## Step 5 — tasks (command: $speckit-tasks)

**Runs when**: tasks.md is missing.

**Dispatch constraints**:
- $ARGUMENTS: none.
- The specialist runs `.specify/scripts/powershell/setup-tasks.ps1` and must enforce the
  strict task format: every task line is `- [ ] T### [P?] [US?] <description with file path>`.

**Verify**:
- `FD/tasks.md` exists; phases present: Setup, Foundational, one per user story, Polish.
- Format sweep: list task lines that violate the format —
  `grep -nE "^- \[" FD/tasks.md | grep -vE "^- \[[ xX]\] T[0-9]{3}( \[P\])?( \[US[0-9]+\])? "` → expect no output.
- A dependencies section and per-story independent test criteria exist.
- No template placeholders remain.

Format violations are mechanical: list them exactly in the repair message.

**Pass when**: format sweep clean, structure complete. **Next**: analyze (pre-implement).

---

## Step 6 — analyze, pre-implement (command: $speckit-analyze)

**Runs when**: tasks.md exists and implementation has not started.

**Dispatch constraints**:
- $ARGUMENTS: none. Strictly read-only — the skill must not modify files. The specialist
  returns the full findings report (table + coverage summary + metrics).

**Manager review** (this is where you earn your keep — triage the findings):
- **CRITICAL** (includes any constitution violation): dispatch a remediation to the
  Speckit-Specialist — a scoped edit instruction, not an analyze re-run: "apply these
  specific analyze findings to the named artifacts" (e.g. add task coverage for FR-007,
  merge duplicate requirements). Then re-run analyze. Max 2 remediation rounds; if
  CRITICAL findings persist, ask the user with the findings and options (fix per
  recommendation / accept and proceed).
- **HIGH**: one remediation attempt; if it persists, ask the user whether to fix or proceed.
- **MEDIUM/LOW**: log them in your progress line and proceed.

Remediation may never weaken the constitution. If a fix requires changing a principle,
that is a user gate.

**Verify**: remediation edits landed (`git diff` shows the recommended changes to the
named artifacts); re-analysis reports zero CRITICAL findings.

**Pass when**: zero CRITICAL (HIGH either fixed or user-approved). **Next**: implement.

---

## Step 7 — implement (command: $speckit-implement) — batched

**Runs when**: analysis is clean and tasks.md has unchecked tasks.

**Pre-gate (manager, before the first implement dispatch)**: scan `FD/checklists/`:
- `requirements.md` unchecked items → spec-quality issues → dispatch a clarify/specify
  repair first. That file is agent-maintained; it should be all-`[x]` before implementing.
- Custom checklists unchecked → AskUserQuestion: list the unchecked items (they are short),
  options: "Approve all as reviewer" / "Proceed with implementation anyway" / "Stop — I'll
  review manually". Honor the answer; record it.

**Batching**: dispatch one `## Phase` section of tasks.md at a time (they are sized to be
independently testable increments). If a phase exceeds ~8 tasks, split it. Scope = first
unchecked task through the end of the phase. Because implement marks tasks `[X]` as it
goes, an interrupted batch is resumable — the next dispatch simply starts at the first
unchecked task.

**Dispatch constraints**:
- $ARGUMENTS: `Execute tasks T00X–T00Y only (Phase N: <name>).` The specialist follows the
  speckit-implement execution rules within that scope, marks completed tasks `[X]` in
  tasks.md, and halts with the error on failure.
- Safety valve: before executing a task that deletes or substantially rewrites existing
  working code (typically a converge `unrequested` remediation), the specialist must
  return NEEDS_INPUT describing the removal — you confirm with the user.

**Verify per batch**:
- Every task in the batch scope is now `[X]` in tasks.md.
- The project's build/test command passes (take it from package.json scripts or
  quickstart.md — for this repo that is the vitest suite).
- `git status --short` shows changes consistent with the batch's file paths (no stray
  rewrites elsewhere).
- Spot-check that 1–2 files named in the batch's tasks exist.

**Failure handling**: a failed task gets a repair dispatch with the task ID and the error
output. If the failure is an artifact gap (the task cannot be done as written — missing
decision, contradictory plan), that is a remediation or a user gate, not a code fix.

**Pass when**: all tasks.md tasks are `[X]` and the final batch's verification holds.
**Next**: analyze (post-implement).

---

## Step 8 — analyze, post-implement (command: $speckit-analyze)

Same mechanics and triage as Step 6. At this point findings usually reflect drift
introduced during implementation (tasks marked done that don't match the spec, coverage
gaps). CRITICAL/HIGH → remediate (a remediation here may be a scoped implement-style
dispatch to fix code, or an artifact fix, per the finding's recommendation); MEDIUM/LOW →
log and proceed.

**Pass when**: zero CRITICAL. **Next**: converge.

---

## Step 9 — converge (command: $speckit-converge)

**Runs when**: all tasks `[X]` and post-implement analysis is done.

**Dispatch constraints**:
- $ARGUMENTS: none. The skill is read-only except for its single write: appending a
  `## Phase N: Convergence` section to tasks.md when it finds actionable gaps. When the
  codebase satisfies everything, tasks.md must remain byte-for-byte unchanged.

**Verify / branch**:
- Outcome `tasks_appended`: check the new section exists, task IDs continue from the
  current maximum, all items unchecked. Increment the convergence-round counter and loop:
  implement (scope = the convergence phase) → converge again.
- Outcome `converged`: confirm tasks.md is unchanged (compare `git hash-object FD/tasks.md`
  before and after the dispatch) and finish.

**Bound**: stop after 3 convergence rounds with residual gaps and report them to the
user — persistent gaps mean something systematic (a mis-scoped spec, a wrong plan
decision) that needs human judgment, not a fourth loop.

**Done**: report feature completion — steps run, artifacts, task totals, test status,
convergence rounds, and the recommendation to review / open a PR.
