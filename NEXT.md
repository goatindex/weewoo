# NEXT — WeeWoo (SES mapping app)

_Convention: update at end of each working session. The weekly portfolio review reads it._

## Current focus

- Agentic-issues pipeline: **all five stages built and merged** (docs-lint → issue contract/BA → reviewer → tech-writer → auto-builder). Now in a settle-and-verify phase — one known bug to fix, a real end-to-end `@claude build` test still owed, and two standing decisions (see Next up). Product work (EMV Phase 2) resumes after.
- EMV historic-record feature (`docs/FEATURE_EMV_HISTORY.md`): Phases 0+1 **live** in private repo `goatindex/emergency-history` — 30-min collector plus nightly derive (per-zone summaries at `summaries/{ZONE}/last-{7,30}d.json`, gap monitor). Raw archive re-partitioned 2026-08-23 to daily segments with a size valve (D-2026-08-23-1) after the old monthly guard silently killed the nightly for 13 nights — fixed and verified live. Next: Phase 2 briefing UI, which first needs the serving decision (private repo → app can't fetch summaries directly; resolve feed licensing then make public, or proxy summaries through the WeeWoo repo)

## Next up

Pipeline settle/verify (do these before more product work):

- **First real `@claude build` test.** Comment `@claude build` on a `ready`+`agent-ready` issue (#14 is the candidate) and confirm the loop actually closes — specifically that the builder's `gh pr create` re-triggers `claude-review.yml` (open question from #27's review: default `GITHUB_TOKEN` may not fire downstream workflows).
- **Tech-writer `workflow_dispatch` test-fire** — the manual verification run added for exactly this was never done.
- #36 — guard auto-builder against duplicate `@claude build` runs + tighten the substring trigger match (`needs-refinement`; dedup mechanism is the open decision).
- Optional: point `claude-build.yml` Step 1 at `docs/ISSUE_CONTRACT.md` (both files now on master) — low value, the builder reads the issue body which is already contract-shaped.

Standing decisions (Kirk's call):

- **OAuth token vs API key for CI Claude workflows.** Today's rate-limit collision (three reviews failed at the first API call, $0/1-turn) is the live evidence D-2026-07-18-3's revisit clause named. Needs a DECISIONS.md entry once picked.
- **Where `ba-issue` is versioned** — in weewoo vs a goatindex skills repo (raised in #33).
- Post-merge `[demo]` verification debt has no tracking mechanism — e.g. PR #20's GoatCounter `error/*` receipt check is still outstanding, only recorded here.

Product backlog:

- Telemetry gap-closure — issue #14 (`ready`, `agent-ready`)
- End-user help/glossary + feedback button (review REC-7.1 / REC-5.2 — still open; not yet an issue)
- EMV Phase 2 briefing UI (needs the serving decision above)
- EMV collector cron reliability — `goatindex/emergency-history`'s 30-min schedule is dropping roughly half its runs (observed gaps 34–77 min against a 30-min cron on 2026-08-23), producing real holes in the incident record independent of the partitioning fix. Likely needs an offset second schedule or self-rescheduling; not yet investigated.

## Done means

- Pipeline: all five stages live on master, the tech-writer scope bug fixed, and one real `@claude build` proven to produce a reviewed PR end-to-end
- EMV: Phase 1 summariser producing per-zone `last-7d` summaries the app can fetch, and a week of collector uptime with no unexplained gaps in STATUS.md

## Done (2026-08-23 session)

- **EMV collector outage fixed.** `goatindex/emergency-history`'s nightly derive had failed silently every night since 2026-08-11 — the monthly raw partition outgrew a hard 5 MB size guard, and because the guard fired _after_ `summarise.js` wrote its output with the commit step gated on success, 13 nights of summaries/`incidents/`/`REPORT.md` were computed then discarded. Re-partitioned the raw archive to daily segments (`raw/YYYY-MM-DD.NNN.ndjson`) with a 60%-of-ceiling size valve for storm days; demoted the size check from fatal to reported (a derive step should never discard completed work over it). Migration of the two legacy monthly files verified lossless (6573 lines in/out, zero content diffs, correct day-bucketing and ordering). Logged as D-2026-08-23-1. Pushed and confirmed live: nightly green again, collector producing daily segments with cross-segment dedupe confirmed on two runs 18s apart. `docs/FEATURE_EMV_HISTORY.md` corrected to match — PR #49.
- **New finding, not yet actioned:** the collector's 30-min cron is dropping roughly half its scheduled runs (see Next up) — a separate, still-open reliability gap in the incident record.
- Housekeeping: noticed while catching NEXT.md up that PR #38 (tech-writer audit scope fix — CLAUDE.md added, false citation dropped) and PR #40 (OIDC `id-token: write` fix for claude-build/tech-writer) landed 2026-07-21/22 without a wrap-up recording them. Recorded here so the log isn't missing them; no other pipeline activity in the gap.

## Done (2026-07-20 session)

- **Pipeline stages 3–5 landed on master.** Stage 3 proven end-to-end: issue #13 (logError) built → PR #20, reviewer caught two real stack-trace regressions, both fixed, merged. Stage 4 (tech-writer, #26) and stage 5 (auto-builder, #27) built, reviewed, merged. #27's review caught a genuine security hole (author gate was in-prompt only, prompt-injectable) — moved to a fail-closed workflow-level `if:` gate; plus fixed a dead eslint tool-grant and added a `ready`-label check.
- **Pipeline hardened via its own process.** Four assessment findings filed as issues, built by delegated agents, reviewed, merged: #30 (mention-job author gate + least-privilege), #32 (narrow review-skip to NEXT/DECISIONS so docs PRs get reviewed), #34 (single-source contract → `docs/ISSUE_CONTRACT.md`), #35 (node:test harness + seed tests, `[test]` now enforceable). Merge pass done in dependency order, master green throughout.
- **Branch-base incident + guard.** A new branch cut off a leftover feature branch (not master) merged PR #20's commits early and auto-closed #13. Left as-is (code was reviewed-clean). Prevented recurrence with a `PreToolUse` hook (`~/.claude/hooks/branch_base_guard.py`) that blocks `git checkout -b` with no explicit base off a non-master branch — see [[branch-base-incident]] memory.
- **Known bug carried forward:** tech-writer scope excludes CLAUDE.md w/ a false D-2026-07-17-1 citation (agreed fix pending — see Next up).
- #36 filed (auto-builder idempotency, `needs-refinement`). D-2026-07-20-1 logged (auto-builder design).

## Done (2026-07-19 session)

- Issue contract v0.2 (EARS/GWT criteria, verification tags, INCOSE weak-word ban, refinement workflow) synced to task.yml, PR #16, decisions D-2026-07-18-1/-2. Retrofitted issues #13/#14 to v0.2.
- Pipeline stage 3 (advisory reviewer) built, activated, and proven end-to-end: PR #17, decision D-2026-07-18-3. Needed three plumbing fixes on first real runs (PRs #21 tool grants, #22 max-turns 50, #23 Read/Grep/Glob + always-post-summary) — all merged.
- Issue #13 (logError) built on branch `logerror-13` → PR #20. The reviewer caught two real stack-trace regressions across two rounds (a string-folded Error losing its trace, then a missed sibling site during the fix) — both fixed, confirmed in-browser, final review clean. PR is mergeable, awaiting merge (see Next up).
- Stage 4 spec'd through our own issues process, dogfooding both untested paths: filed issue #24 as `needs-refinement` (four open decisions stated, not guessed), then promoted via Workflow B once the decisions were resolved in conversation (mechanism: GitHub Action schedule; scope: staleness + readability; output: self-contained prompt, cap 2/run, dedup; cadence: weekly Friday AEST). Now `ready` + `agent-ready`.

## Done (2026-07-18 session)

- Issue contract landed (pipeline stage 2): label taxonomy (`type:*`, `size:*`, `ready`, `needs-refinement`, `agent-ready`), Task/Feature issue form (PR #12), personal `ba-issue` BA skill (braindump → researched, DoR-checked issue). Pilot issues #13 (logError) and #14 (telemetry events) filed through it — both ready + agent-ready.

## Done (2026-07-17 session)

- Docs lint gate landed (first component of the agentic-issues pipeline, WeeWoo as pilot): Vale 3.15.1 (Microsoft package, tuned to house style — see D-2026-07-17-1) + markdownlint-cli2 + lychee, strict gate (warnings fail), all tracked markdown. `npm run lint:docs` locally, `.github/workflows/docs-lint.yml` in CI. Full shakeout done: 609 Vale findings and 108 markdownlint issues triaged to zero. Merged to master as PR #10; lychee's first runs surfaced two real doc fixes (links to gitignored flood files, frozen-review links to deleted `app.js`) plus a 302 cookie-gate allowance for `discover.data.vic.gov.au`.
- Pipeline next: GitHub Issue Form template + BA skill (issue "context capsules"), then reviewer action on PRs, then weekly tech-writer cron.

## Done (2026-07-10 session)

- Sectorisation visibility defect fixed: "Hide sector overlay" detached the layer groups permanently, killing the sidebar eye toggle; unified on `_hiddenSectors` + defensive re-attach. Verified in browser. (`sectorisation.js?v=4`, shell v8)
- Node-editing items from the old list were already shipped in d0f97b1 (14 May) — merge-confirm, junction nodes, type-aware delete. Stale entries removed.
- CI asset-sync guard added (`scripts/check-sync.js`) — fails when index.html / sw.js / build.js asset lists disagree
- Local `www/` + Android bundles re-synced; orphaned pre-split `app.js` deleted from both
- CLAUDE.md fiction fixed: save-backends.js / cloud backends / #share= URL sharing marked planned-not-built
- `docs/FEATURE_SAVE_LOAD.md` committed

## Parked

- Cross-user save sharing (file export/import is the mechanism, per docs decision)
- Ops runbooks (review REC-6.1) — low urgency for single-operator project

## Last updated

2026-08-23
