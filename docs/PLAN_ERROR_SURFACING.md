# Plan: Error Surfacing (`logError`)

**Status:** Planned
**Date:** 2026-07-10
**Implements:** review REC-2.2; unblocks the <2% error-rate metric in `PLAN_TELEMETRY.md`

## Design

One helper in `core.js`, next to `trackEvent`:

```js
/* Central error reporter: always logs to console; also emits a telemetry
   event so failure rates are visible in GoatCounter. `scope` is a short
   stable slug (e.g. 'layer-load', 'save-restore'); never include user data
   or coordinates in `scope` or the message sent to telemetry. */
function logError(scope, err, userMessage) {
  console.error(`[WeeWoo:${scope}]`, err);
  trackEvent(`error/${scope}`, String(err && err.message || err).slice(0, 80));
  if (userMessage) alert(userMessage); // replace with toast if/when a shared toast helper exists
}
```

Rules of use:

- **Convert** a catch when the failure loses user data or user-visible function (persistence writes, save restore, data loads, imports).
- **Leave silent** the *expected-degenerate probes* — the `turf.booleanPointInPolygon` / `turf.area` try/catches in `sectorisation.js` fire on degenerate geometry during normal editing and are handled by falling through; instrumenting them would flood telemetry with non-errors.
- A catch that already `console.warn`s keeps its message but routes through `logError` so it also counts in telemetry.

## Site inventory and disposition

| Site | Current behaviour | Disposition |
|------|-------------------|-------------|
| `data-loading.js:69` — group GeoJSON fetch fails | `console.error` + inline "Failed to load data" | `logError('layer-load', err)` — keep the inline message |
| `persistence.js:29` — corrupt `weewoo_layers_v1` | silently deletes the key | `logError('layers-restore', err)` — user's layer state just vanished; today invisible |
| `persistence.js:101` — corrupt saves index | silently returns `[]` | `logError('saves-index', err)` — all saves disappear from the modal; today invisible |
| `persistence.js:116` — save write fails (quota) | `console.warn` + alert | route through `logError('save-write', err)` |
| `persistence.js:198` — sectorisation key restore fails | `console.warn` | `logError('save-restore', err)` |
| `persistence.js:250` — save-file import parse fails | alert only | `logError('save-import', err)` — keep the alert |
| `persistence.js:268` — save load fails | alert only | `logError('save-load', err)` — keep the alert |
| `pins.js:59` — corrupt pins JSON | silently returns `[]` | `logError('pins-restore', err)` — user pins vanish; today invisible |
| `init.js:155` — service worker registration fails | `console.warn` | `logError('sw-register', err)` — offline promise silently broken |
| `sectorisation.js:511` — sectorisation localStorage save fails | `console.warn` | `logError('sector-save', err)` — user's drawn sectors are being lost |
| `sectorisation.js:773,1752,1843` — malformed stored sector entries | `console.warn` | `logError('sector-restore', err)` (one scope for all three) |
| `sectorisation.js:1794` — import invalid JSON | toast only | `logError('sector-import', err)` — keep the toast |
| `sectorisation.js:1800,1805` — import write fails | `console.warn` | `logError('sector-import', err)` |
| `sectorisation.js` geometry probes (202, 249, 256, 518, 558, 575, 709, 721, 1352, 1361, 1366) | silent fall-through | **leave as-is** (expected-degenerate; see rules) |
| `sectorisation.js:215,225,1034` — JSTS noding/polygonize failures | needs reading at implementation time | likely `logError('sector-geometry', err)` — these mean the tool visibly failed to compute sectors |

## Steps

1. Add `logError` to `core.js` (after `trackEvent`).
2. Convert the sites above, top to bottom — each is a 1-line change.
3. Grep-verify no silent `catch {}`/`catch { return … }` remains outside the approved geometry-probe list.
4. Bump `?v=` on touched files + `SHELL_CACHE`; `node scripts/check-sync.js`; `npm run build`.
5. Verify: corrupt `weewoo_layers_v1` by hand in devtools, reload, confirm console line + GoatCounter event.

**Effort:** S (2–3 hours). No behaviour changes for the user beyond errors becoming visible.
