# Issue Contract

<!-- markdownlint-disable-next-line MD036 -->
**Vendored file — do not edit here.**

The master text lives in the `ba-issue` skill, in the private repo
`goatindex/claude-workflow`:

- Work-item contract, Definition of Ready, agent-ready bar —
  `skills/ba-issue/SKILL.md`
- Acceptance-criteria rules — `skills/ba-issue/references/acceptance-criteria.md`

This copy exists because tooling in this repository reads the contract from a
checkout and cannot reach a private repo: `.github/workflows/tech-writer.yml`
and `.github/workflows/claude-build.yml` both read it at run time, and
`.github/ISSUE_TEMPLATE/task.yml` links to it. Change the master, then
re-vendor here. If the two disagree, the master wins.

Only the "Labels in this repository" section below is local to WeeWoo.

## How issues are written here

Every issue — whether hand-raised through the GitHub issue form, drafted by the
`ba-issue` skill, or filed by a pipeline agent — carries the same contract so a
builder (human or agent) can execute it cold.

A visible "none" in a section is information; an absent section is ambiguity. No
section is ever omitted.

## The seven sections

Emit these sections as `###` headings, in this order. They match what the issue
form renders for hand-raised issues.

| Section | What belongs there |
|---|---|
| `### Problem / why now` | What is wrong or missing, and why it matters now rather than later. For `type:bug`: minimal reproduction steps and observed-versus-expected behaviour live here. |
| `### Desired outcome` | The end state in plain language — what exists or behaves differently when the work is done. |
| `### Acceptance criteria` | Testable statements per "Writing acceptance criteria" below. For bugs, one criterion is always the regression check. |
| `### Non-goals` | Where the builder stops. Write "none" only if truly unbounded — and that is a deliberate statement. |
| `### Context pointers` | Files (`path:line` where useful), docs, DECISIONS.md entries, prior issues or PRs a cold builder needs. Paths clickable from the repo root. |
| `### Dependencies, assumptions & risks` | Blocked-by issues, external prerequisites, assumptions the work rests on, known risks with their mitigations. Write "none" if none. |
| `### Size` | S (hours; single sitting) / M (a day or two) / L (multi-day; consider splitting now), plus the escape hatch: "If this exceeds ~2x the estimate, stop and split." |

Title: imperative, 70 characters or fewer, no prefixes or brackets.

## Writing acceptance criteria

Each criterion is one testable sentence in one of the forms below, ending with a
verification tag.

### EARS patterns (for behaviours)

- Ubiquitous: "The `<system/part>` shall `<behaviour>`."
- Event-driven: "**When** `<trigger>`, the `<part>` shall `<behaviour>`."
- State-driven: "**While** `<state>`, the `<part>` shall `<behaviour>`."
- Unwanted behaviour: "**If** `<failure/abnormal condition>`, **then** the
  `<part>` shall `<response>`."
- Optional feature: "**Where** `<feature is present>`, the `<part>` shall
  `<behaviour>`."

### Given/When/Then (for user scenarios)

"Given `<context>`, when `<action>`, then `<observable result>`." Use GWT when a
user walks through a scenario; EARS otherwise.

### Verification tags

Every criterion ends with how it will be verified:

- `[test]` — automated or scripted check.
- `[demo]` — drive the running app and observe.
- `[inspect]` — read the code, config, or dashboard.
- `[analyze]` — reason over data or logs.

The tags let the reviewer ask a mechanical question: was each criterion verified
by its declared method? A tag naming a method nobody can run in the available
environment is a defect in the criterion.

### Banned words

None of these may appear in a criterion (outside quoted strings or code
literals); each names a hidden judgment call that belongs in the criterion
itself:

> appropriate, adequate, as needed, as required, easy, easily, efficient, fast,
> quickly, flexible, handle, robust, seamless, support, user-friendly, etc.,
> TBD, TBC.

Rewrite to the measurable thing meant — "loads in under 2 s on 3G" not "loads
quickly". This ban comes from INCOSE requirements practice.

Three sharp criteria beat eight vague ones; a criterion no one would ever
actually check is noise wearing a checkbox.

### Marking gaps

Where something genuinely is not known, write the question rather than the hole:

```text
[NEEDS CLARIFICATION: which of the two export formats is authoritative?]
```

A bare "TBD" records that someone stopped thinking. A clarification marker
records what they stopped on.

## Definition of Ready

Every line must pass for the `ready` label:

- Desired outcome describes an observable end state, not an activity.
- Every acceptance criterion is in EARS or GWT form with a verification tag.
- No acceptance criterion contains a banned word (see "Writing acceptance
  criteria").
- Non-goals section is present and deliberate (a considered "none" passes).
- Every context pointer verified: file paths exist in the repo now; issue, PR,
  and decision references are real. Unverifiable pointers are marked
  "(unverified)" and fail this line.
- Dependencies and assumptions identified, or an explicit "none".
- Size estimated. If L: splitting was considered, and the body says why it was
  not split — or the work is redirected to a requirements-doc pass first.
- No decision requiring the user's judgment is left implicit in the body —
  either it was asked, or the issue is `needs-refinement` with the open question
  stated as a `[NEEDS CLARIFICATION: ...]` marker.

An issue that fails any line is filed with `needs-refinement` rather than
`ready`; the label is the warning, and the open questions are stated in the
body.

## The agent-ready bar

`agent-ready` marks issues suitable for autonomous implementation. All of:

- The `ready` label is earned.
- Size is S or M.
- Context pointers give a cold-start path (entry file plus the pattern to
  follow).
- Zero open judgment calls.
- Every acceptance criterion's tag names a method an agent can execute —
  `[test]`, `[inspect]`, or a `[demo]` drivable in the app or preview — nothing
  that needs human taste to verify.

## Labels in this repository

This section is local to WeeWoo; the labels below exist in this repo.

- Type (exactly one): `type:feature` `type:bug` `type:docs` `type:chore`
- Size (exactly one): `size:S` `size:M` `size:L`
- Readiness (exactly one): `ready` `needs-refinement`
- Autonomy (optional): `agent-ready` — added only when the agent-ready bar is
  met.

## Why the contract is shaped this way

The contract practises agile and lean requirements refinement: Scrum's
Definition of Ready as the quality gate, BDD and EARS acceptance criteria, and
the spec-driven "context capsule" pattern for self-containment. Two bolt-ons
come from INCOSE requirements practice: the EARS sentence patterns and the
banned-word list.

It is deliberately not plan-driven requirements engineering — no baselined spec,
no traceability matrix, no requirement IDs; issues are cheap, disposable units
of intent. Priority is deliberately absent from the contract: sequencing lives
in NEXT.md and the priority labels, not inside issue bodies.

Size is under review upstream. It currently does three jobs — a split prompt at
authoring, the autonomy gate, and the builder's stop condition. Once work
arrives already broken down, all three get better mechanisms. Do not build new
dependencies on it.

## Provenance

The version history of the contract before it moved upstream is recorded in
DECISIONS.md (D-2026-07-18-1, D-2026-07-18-2). The move itself is
D-2026-07-27-1.
