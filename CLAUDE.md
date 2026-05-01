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

## Skills

- **`anthropic-skills:leaflet`** — invoke for any Leaflet.js implementation work (layer loading, plugins, map interactions)
- **`.claude/skills/geospatial.md`** — invoke for GIS data acquisition, format conversion, ArcGIS/WFS APIs, flood data; auto-loaded by trigger description
