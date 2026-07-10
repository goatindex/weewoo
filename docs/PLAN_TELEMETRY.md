# Plan: Telemetry Gap Closure

**Status:** Planned
**Date:** 2026-07-10
**Supersedes:** review REC-5.1 (partially — the "add analytics" half shipped 2026-05-14 in `7d4cb94`)

## What already exists

GoatCounter (`https://weewoo.goatcounter.com`) is live:

- Page views via the standard script tag in `index.html`
- A `trackEvent(name, extra)` helper in `core.js` (no-ops when GoatCounter is blocked/absent)
- Events: `save_created` (with layer count), `save_loaded`, `layer_loaded` (with groupId), `sectorise_entered`
- Privacy notice in `modals.js` names GoatCounter and links its GDPR page

## Gap analysis vs PRODUCT_BRIEF success metrics

| Metric | Measurable today? | Gap / plan |
|--------|-------------------|------------|
| 500 MAU | **Yes** — GoatCounter unique visitors | none |
| ≥3 avg layers enabled | **Approximate** — `layer_loaded` events ÷ visits gives a fleet-wide ratio, not a per-session average | accept the proxy; GoatCounter has no session grouping and adding one would defeat its privacy model |
| >40% return rate | **No** — GoatCounter rotates visitor hashes daily by design | add a `returning_visit` event: on app init, check a `weewoo_first_seen` localStorage timestamp; if it exists and is >24h old, fire the event once per day. No identifier leaves the browser — the flag is self-reported |
| <2% error rate | **No** — no error events exist | blocked on `logError` (see `PLAN_ERROR_SURFACING.md`); error rate = `error/*` events ÷ visits |
| Mobile share | **Yes** — GoatCounter device breakdown | none |

## New events

| Event | Where | Why |
|-------|-------|-----|
| `error/{scope}` | `logError` helper (PLAN_ERROR_SURFACING.md) | the <2% error-rate metric |
| `returning_visit` | `init.js` `initApp` | the return-rate metric |
| `sectorise_saved` | `sectorisation.js` `_commit` path (once per session-save, not per keystroke) | funnel: `sectorise_entered` → `sectorise_saved` shows tool completion rate |
| `sector_export` | `exportGeoJSON` / `exportSectorBundle` | is the export path used at all? |
| `pin_created` | `pins.js` pin-save handler | feature usage baseline |
| `search_used` | `sidebar.js` search input (debounced, once per session) | feature usage baseline |

Naming: keep flat `snake_case` names; the `error/` prefix is the one exception so GoatCounter's path filter can isolate errors.

## Implementation steps

1. Land `logError` per `PLAN_ERROR_SURFACING.md` (it feeds `error/{scope}`).
2. Add the five product events above — each is a one-line `trackEvent` call at an existing code site.
3. `returning_visit`: ~8 lines in `init.js` + one new localStorage key (`weewoo_first_seen`); document the key in CLAUDE.md.
4. Bump `?v=` on each touched file + `SHELL_CACHE`; run `node scripts/check-sync.js`; `npm run build`.
5. Verify in GoatCounter dashboard after deploy (events appear under Pages with `event=true`).

**Effort:** S (half a day including verification).

## Non-goals

- No cookies, no fingerprinting, no persistent identifiers, no additional third parties.
- No per-session analytics — GoatCounter's privacy model is a feature; work within it.
- No self-hosting move (Umami/Plausible) unless GoatCounter's free tier becomes a constraint; revisit only if event volume exceeds ~100k/month.
