# NEXT — WeeWoo (SES mapping app)

_Convention: update at end of each working session. The weekly portfolio review reads it._

## Current focus

- Agentic-issues pipeline: **all five stages built and merged** (docs-lint → issue contract/BA → reviewer → tech-writer → auto-builder). Now in a settle-and-verify phase — one known bug to fix, a real end-to-end `@claude build` test still owed, and two standing decisions (see Next up). Product work (EMV Phase 2) resumes after.
- EMV historic-record feature (`docs/FEATURE_EMV_HISTORY.md`): Phases 0+1 **live** in private repo `goatindex/emergency-history` — 30-min collector plus nightly derive (per-zone summaries at `summaries/{ZONE}/last-{7,30}d.json`, gap monitor, size guard). Next: Phase 2 briefing UI, which first needs the serving decision (private repo → app can't fetch summaries directly; resolve feed licensing then make public, or proxy summaries through the WeeWoo repo)

## Next up

Pipeline settle/verify (do these before more product work):

- **First real `@claude build` test.** Comment `@claude build` on a `ready`+`agent-ready` issue (#14 is the candidate) and confirm the loop actually closes — specifically that the builder's `gh pr create` re-triggers `claude-review.yml` (open question from #27's review: default `GITHUB_TOKEN` may not fire downstream workflows).
- **Tech-writer `workflow_dispatch` test-fire** — the manual verification run added for exactly this was never done.
- #36 — guard auto-builder against duplicate `@claude build` runs + tighten the substring trigger match (`needs-refinement`; dedup mechanism is the open decision).
- Optional: point `claude-build.yml` Step 1 at `docs/ISSUE_CONTRACT.md` (both files now on master) — low value, the builder reads the issue body which is already contract-shaped.

Standing decisions (Kirk's call):

- **OAuth token vs API key for CI Claude workflows.** Today's rate-limit collision (three reviews failed at the first API call, $0/1-turn) is the live evidence D-2026-07-18-3's revisit clause named. Needs a DECISIONS.md entry once picked.
- Post-merge `[demo]` verification debt has no tracking mechanism — e.g. PR #20's GoatCounter `error/*` receipt check is still outstanding, only recorded here.

Product backlog:

- Telemetry gap-closure — issue #14 (`ready`, `agent-ready`); PR #41 open against it
- End-user help/glossary + feedback button (review REC-7.1 / REC-5.2 — still open; not yet an issue)
- EMV Phase 2 briefing UI (needs the serving decision above)

## Done means

- Pipeline: all five stages live on master, the tech-writer scope bug fixed, and one real `@claude build` proven to produce a reviewed PR end-to-end
- EMV: Phase 1 summariser producing per-zone `last-7d` summaries the app can fetch, and a week of collector uptime with no unexplained gaps in STATUS.md

## Done (2026-07-27 session)

- **PR #42 — the issue contract moves upstream.** `docs/ISSUE_CONTRACT.md` becomes a vendored, generated copy naming the `ba-issue` skill in private repo `goatindex/claude-workflow` as master. Full text retained on purpose: `tech-writer.yml` and `claude-build.yml` read it from the checkout at run time and cannot reach a private repo, so a local copy has to exist regardless — which makes vendoring free and leaves only the question of which copy is authoritative. Only "Labels in this repository" is local now. Adds the `[NEEDS CLARIFICATION: <question>]` rule and a note that `Size` is under review upstream. `npm run lint:docs` clean. Decision D-2026-07-27-1.
- **Resolves the standing "where is `ba-issue` versioned" question (#33)** — it is versioned in `goatindex/claude-workflow`, and this repo vendors what its CI needs.
- Context: the contract was single-sourced here by #34, correct while WeeWoo was its only consumer. A cross-project baseline against GitHub Spec Kit found the rules are domain-neutral apart from the label taxonomy, and that keeping the master here left the other eight projects unable to reach it. Full reasoning in `D:\mpd\NEXT.md` (27 Jul entry).
- Not this session, but landed since the 20 Jul wrap-up and pruned from Next up above: PR #38 (tech-writer audit scope fixed — CLAUDE.md included, false D-2026-07-17-1 citation removed, follow-up issue #39 filed) and PR #40 (`id-token: write` OIDC auth fix on claude-build and tech-writer).

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

2026-07-27
