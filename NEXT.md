# NEXT — WeeWoo (SES mapping app)

_Convention: update at end of each working session. The weekly portfolio review reads it._

## Current focus

- EMV historic-record feature (`docs/FEATURE_EMV_HISTORY.md`): Phases 0+1 **live** in private repo `goatindex/emergency-history` — 30-min collector plus nightly derive (per-zone summaries at `summaries/{ZONE}/last-{7,30}d.json`, gap monitor, size guard). Next: Phase 2 briefing UI, which first needs the serving decision (private repo → app can't fetch summaries directly; resolve feed licensing then make public, or proxy summaries through the WeeWoo repo)

## Next up

- Telemetry gap-closure per `docs/PLAN_TELEMETRY.md` (GoatCounter is live; error events + coverage gaps remain)
- Error surfacing per `docs/PLAN_ERROR_SURFACING.md` (`logError` helper replacing silent catches)
- End-user help/glossary + feedback button (review REC-7.1 / REC-5.2 — still open)

## Done means

- Phase 1 summariser producing per-zone `last-7d` summaries the app can fetch, and a week of collector uptime with no unexplained gaps in STATUS.md

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

2026-07-17
