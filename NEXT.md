# NEXT — WeeWoo (SES mapping app)

_Convention: update at end of each working session. The weekly portfolio review reads it._

## Current focus

- EMV historic-record feature (`docs/FEATURE_EMV_HISTORY.md`): Phases 0+1 **live** in private repo `goatindex/emergency-history` — 30-min collector plus nightly derive (per-zone summaries at `summaries/{ZONE}/last-{7,30}d.json`, gap monitor, size guard). Next: Phase 2 briefing UI, which first needs the serving decision (private repo → app can't fetch summaries directly; resolve feed licensing then make public, or proxy summaries through the WeeWoo repo)

## Next up

- Error surfacing per `docs/PLAN_ERROR_SURFACING.md` — now issue #13 (ready, agent-ready)
- Telemetry gap-closure per `docs/PLAN_TELEMETRY.md` — now issue #14 (ready, agent-ready)
- End-user help/glossary + feedback button (review REC-7.1 / REC-5.2 — still open; not yet an issue)
- **Merge PR #20** (logError, Closes #13) — built, reviewed clean by the auto-review action, all checks green, mergeable. Merge is a human step by design. Post-merge: verify GoatCounter receives the `error/*` event (issue #13's AC1 [demo] half that can't be checked from localhost)
- Build issue #24 (scheduled tech-writer/docs-audit agent — pipeline stage 4, `ready` + `agent-ready`): new workflow copying `claude-review.yml`'s shape (`schedule:` trigger instead of `pull_request`, self-contained prompt embedding the task.yml contract, 2-issue/run cap, dedup via `gh issue list --search`)

## Done means

- Phase 1 summariser producing per-zone `last-7d` summaries the app can fetch, and a week of collector uptime with no unexplained gaps in STATUS.md

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

2026-07-19
