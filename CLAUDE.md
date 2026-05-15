# WeeWoo — Project Guide for Claude

WeeWoo is a multi-state Australian emergency services map built on Leaflet 1.9.4. It shows CFA, FRV, SES, ambulance, and police layers for all states and territories.

## Critical: Two Codebases

There are two separate `app.js` files with different architectures. **Never edit `www/app.js` or `android/.../app.js` directly** — they are build outputs.

| File | Purpose | Config source |
|------|---------|---------------|
| `app.js` (root) | GitHub Pages (live web app) | Fetches `config/layers.json` at runtime |
| `www/app.js` | Capacitor web bundle — built by `scripts/build.js` | Config inlined at build time |
| `android/app/src/main/assets/public/app.js` | Android APK bundle | Config inlined at build time |

`scripts/build.js` copies `app.js`, `index.html`, `style.css`, `manifest.json`, `sw.js`, `icons/`, `geojson/`, and `config/` from root → `www/`.

## Adding or Modifying Layers

All layer changes require edits in **two places**, then a build:

1. **`config/layers.json`** — add/edit the layer entry
2. **`app.js` `FILTERS` map** (top of file) — only if the layer needs a named filter function

Then run:
- `npm run build` — syncs everything to `www/` (GitHub Pages + Capacitor web)
- `npm run cap:sync` — also propagates to the Android project

`www/app.js` and `android/.../app.js` are build outputs — never edit them directly.

## GeoJSON Files — Three Locations

GeoJSON files live in three directories and must be kept in sync manually:

| Directory | Used by |
|-----------|---------|
| `geojson/` | Source of truth; also served by GitHub Pages |
| `www/geojson/` | Capacitor web bundle |
| `android/app/src/main/assets/public/geojson/` | Android APK |

After creating or updating a GeoJSON file, copy it to all three locations. The build script copies the whole `geojson/` directory, but only when you run it — it doesn't run automatically.

## Layer Config Schema (`config/layers.json`)

```json
{
  "id": "STATE__group_name",
  "label": "Human-readable label",
  "type": "polygon" | "point",
  "color": "#rrggbb",
  "fillColor": "#rrggbb",
  "fillOpacity": 0.12,        // polygons only
  "weight": 1,                // polygons only
  "markerRadius": 6,          // points only
  "file": "geojson/STATE/filename.geojson",
  "nameKey": "FIELD_NAME",
  "singleFeature": false,
  "isSESFacilityGroup": false,
  "sesLinking": null,
  "filter": null              // string key into FILTERS map in app.js, or null
}
```

`sesLinking` wires a zone polygon layer to a point facility layer so enabling a zone auto-enables its HQ facility:
```json
"sesLinking": {
  "linkedGroupId": "VIC__ses_facilities",
  "zoneNameKey": "HQ_FACILITY_NAME"
}
```

## GeoJSON File Naming Convention

Files follow `{org}_{level}_bld.geojson` for building/facility points:
- `cfa_brigade_bld.geojson` — CFA brigade main stations (derived from `cfabld.geojson`)
- `cfabld.geojson` — complete CFA building source (main + satellite stations; retain as-is)
- Future: `cfa_district_bld.geojson`, `cfa_region_bld.geojson`

## Primary Boundary Data Source

`https://emapdev.ffm.vic.gov.au/arcgis/rest/services/vsw_boundaries/MapServer`

ArcGIS REST API. Max 1000 records per request — paginate with `resultOffset`. No licensing statement on the server; underlying data is Vicmap (CC BY 4.0).

| Layer ID | Name |
|----------|------|
| 4 | CFA Districts |
| 5 | CFA Regions |
| 6 | CFA Brigade Response Boundaries |
| 7 | Victorian Government Regions |
| 8 | L3 ICC Footprints |
| 9 | PV Region Boundaries |
| 10 | PV District Boundaries |
| 11 | PV Areas |
| 12 | Local Government Areas |
| 13 | FRV Districts |
| 14 | FRV Regions |
| 15 | SES Regions |
| 16 | SES Response Boundaries |

Query pattern:
```
/MapServer/{layerId}/query?where=1%3D1&outFields=*&f=geojson&resultOffset={offset}&resultRecordCount=1000
```

## Deploying Changes

After merging to master, GitHub Pages rebuilds automatically. However, browsers cache `app.js` and `style.css` for ~10 minutes. To force users to get fresh assets after a significant change, bump the `?v=N` query string on the relevant tags in `index.html`:

```html
<link rel="stylesheet" href="style.css?v=3" />
<script src="app.js?v=3"></script>
```

Increment N by 1 each time. `index.html` itself is served with short cache headers so browsers always pick up the new version number.

**Also bump `SHELL_CACHE` in `sw.js`** when you bump `?v=N` — format is `'weewoo-shell-vN'` where N matches the highest version number across all three assets. This tells installed service workers to discard the old app shell and precache the new one on next visit.

## Save / Load and URL Sharing

### localStorage keys

The app uses these keys in addition to `weewoo_layers_v1` and other existing preference keys:

| Key | Value |
|-----|-------|
| `weewoo_saves_index_v1` | JSON array of `{name, createdAt, byteSize, layerCount}` — index of all local saves |
| `weewoo_save_{name}` | Full JSON save object (schema v1); key e.g. `weewoo_save_mysave_20260511T143022Z` |
| `weewoo_save_prefix` | Last-used save name prefix (string) |
| `weewoo_save_notice_v1` | `'1'` once the first-save browser-storage warning has been shown |
| `weewoo_storage_backend` | Selected backend ID: `'local'`, `'gdrive'`, `'onedrive'`, or `'dropbox'` |

### `save-backends.js`

A new root-level plain global script (not an ES module). Load it in `index.html` before `app.js`, with `?v=1` cache-busting:

```html
<script src="save-backends.js?v=1"></script>
```

It attaches `window.SaveBackends = { LocalStorageBackend, GoogleDriveBackend, OneDriveBackend, DropboxBackend }`. Add it to the `scripts/build.js` copy list so it reaches `www/` and the Android bundle.

### URL sharing hash format

Share links use the URL hash:

```
#share=<base64(gzip(JSON({ layers: { enabled, ses } })))>
```

Detected and applied at app init via `initShareDetection()`. Only layer state is encoded — no map view, UI prefs, or custom markers. The hash is cleared after loading via `history.replaceState`.

### Cloud backend registration

Each cloud backend requires a one-time app registration with the GitHub Pages origin whitelisted:

| Provider | Console | Setting |
|----------|---------|---------|
| Google Drive | Google Cloud Console | Authorized JavaScript origin |
| OneDrive | Azure App Registration | Redirect URI (SPA) |
| Dropbox | Dropbox App Console | OAuth 2 redirect URI |

Register `https://goatindex.github.io` for production and `http://localhost` (separate client ID) for local dev. Client IDs and App keys are public values — safe to ship in JS source.

## Sectorisation tool

The Sectorisation tool subdivides a zone polygon (or a union of several) into named "sectors" by letting the user draw dividing lines across it. Sectors get NATO phonetic names (Alpha, Bravo, Charlie…) and user-chosen colours, and persist to localStorage so they survive page reloads and tool deactivation.

### Files

| File | Role |
|------|------|
| `sectorisation.js` (root) | Feature implementation — plain IIFE that attaches `window.SectorisationTool` |
| `index.html` | Loads JSTS + turf CDNs and `sectorisation.js` before `app.js` |
| `app.js` | Calls `SectorisationTool.init(map)` and wires the footer "Sectorise" button |

`sectorisation.js` is already in `scripts/build.js`'s copy list, so changes auto-sync to `www/` and the Android bundle on `npm run build`.

### Geometry library stack

| Lib | Used for | Where |
|-----|----------|-------|
| **JSTS 2.12** | Robust noding + polygonize (handles T/X-junctions and vertex-touches) | ONLY inside `computeSectors()` — `jsts.io.GeoJSONReader/Writer`, `LineString.union()`, `jsts.operation.polygonize.Polygonizer` |
| **Turf v6** | Centroids, area, point-in-polygon, polygon/feature wrapping | ~18 calls across the file (sector centroids, sector hit-tests, merge-inheritance area comparisons) |
| **Leaflet 1.9.4** | Map, panes, polygons, polylines, circle markers, div icons | Rendering only |

JSTS is loaded after Leaflet and before Turf in `index.html`:

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/jsts@2.12.1/dist/jsts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js"></script>
<script src="sectorisation.js?v=N"></script>
```

### localStorage keys

| Key | Value |
|-----|-------|
| `weewoo:sectorisation:{polygonId}` | Per-parent graph: `{ nodes, lines, nameOverrides, colorOverrides, opacityOverrides, parentRing, parentHash }` |

`polygonId` is the sorted-joined `{groupId}::{featureName}` parts for the polygon(s) used as parent (e.g. `VIC__ses_zones::ALEXANDRA` or `VIC__ses_zones::ZoneA|VIC__ses_zones::ZoneB`). The sort makes the ID order-independent for multi-polygon selections.

`parentHash` is a fingerprint of the parent ring's coordinates, used to warn the user if the source polygon boundary has drifted since the sectorisation was saved (FR-43).

### Cache busting

After significant changes to `sectorisation.js`, bump the version in `index.html`:

```html
<script src="sectorisation.js?v=N"></script>
```

Then `npm run build` to propagate. The current version is whatever's in `index.html`.

## Layer Ordering Convention

Top-level states in `config/layers.json` must follow this order:
1. National
2. All states/territories alphabetically (ACT, NSW, NT, QLD, SA, TAS, VIC, WA)

Within each state, groups must follow this order:
1. SES (zones, then facilities)
2. Fire service (CFA, NSWRFS, etc. — whatever applies to that state)
3. LGA
4. FRV Coverage (VIC only — sits between LGA and Ambulance)
5. Ambulance
6. Police (VIC only)
7. Flood (VIC only)

## Skills

- **`anthropic-skills:leaflet`** — invoke for any Leaflet.js implementation work (layer loading, plugins, map interactions)
- **`.claude/skills/geospatial.md`** — invoke for GIS data acquisition, format conversion, ArcGIS/WFS APIs, flood data; auto-loaded by trigger description
