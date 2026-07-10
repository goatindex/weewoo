# NEXT — WeeWoo (SES mapping app)

_Convention: update at end of each working session. The weekly portfolio review reads it._

## Current focus
- EMV historic-record feature: options analysis in `docs/FEATURE_EMV_HISTORY.md` — pick an architecture option, then build

## Next up
- Telemetry gap-closure per `docs/PLAN_TELEMETRY.md` (GoatCounter is live; error events + coverage gaps remain)
- Error surfacing per `docs/PLAN_ERROR_SURFACING.md` (`logError` helper replacing silent catches)
- End-user help/glossary + feedback button (review REC-7.1 / REC-5.2 — still open)

## Done means
- EMV architecture decision recorded in DECISIONS.md and first data pipeline run green

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
2026-07-10
