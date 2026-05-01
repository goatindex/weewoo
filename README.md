# WeeWoo — Emergency Services Map

An interactive map of Australian emergency service facilities and response areas. Covers SES, ambulance, police, CFA, and FRV across all states and territories.

Built with vanilla JavaScript, [Leaflet.js](https://leafletjs.com/), and [Capacitor](https://capacitorjs.com/) for native mobile.

---

## Running locally

**Requirements:** Node.js 18+

```bash
npm install
npm start
```

Opens a dev server at `http://localhost:8080`. The server serves all files with `no-cache` headers so changes are reflected on reload.

---

## Building for mobile

```bash
# Build web assets and sync to Android
npm run cap:android

# Build web assets and sync to iOS
npm run cap:ios
```

These commands run `npm run build` (copies web assets to `www/`), sync to the native project via Capacitor, then open the platform IDE.

---

## Project structure

```
/
├── app.js              # All application logic
├── index.html          # HTML shell
├── style.css           # All styles
├── config/
│   └── layers.json     # Layer definitions — edit this to add data layers
├── geojson/            # GeoJSON data files, organised by state
│   ├── au.json
│   ├── VIC/
│   ├── NSW/
│   └── ...
├── icons/              # App icons (SVG source + PNG outputs)
├── scripts/
│   ├── build.js        # Copies web assets to www/ for Capacitor
│   └── generate-icons.js
├── www/                # Built output — do not edit directly
└── android/            # Native Android project
```

---

## Adding a new data layer

All layer definitions live in `config/layers.json`. No code changes are needed for standard layers.

### Step 1 — Add the GeoJSON file

Place your GeoJSON file in the appropriate state directory under `geojson/`. The file must use WGS84 coordinates (EPSG:4326).

```
geojson/NSW/fire_stations.geojson
```

### Step 2 — Add an entry to `config/layers.json`

Find the state entry (e.g. `"id": "NSW"`) and add a new object to its `groups` array:

```json
{
  "id": "NSW__fire_stations",
  "label": "Fire Stations",
  "type": "point",
  "color": "#cc2200",
  "fillColor": "#cc2200",
  "markerRadius": 6,
  "file": "geojson/NSW/fire_stations.geojson",
  "nameKey": "station_name",
  "singleFeature": false,
  "isSESFacilityGroup": false,
  "sesLinking": null,
  "filter": null
}
```

**Field reference:**

| Field | Description |
|-------|-------------|
| `id` | Unique identifier — must be `STATEID__descriptor`, no spaces |
| `label` | Display name shown in the sidebar |
| `type` | `"point"` for facilities, `"polygon"` for areas/zones |
| `color` | Stroke colour (hex) |
| `fillColor` | Fill colour for polygons (hex) |
| `fillOpacity` | Fill transparency for polygons (`0`–`1`, default `0.15`) |
| `weight` | Stroke width in pixels (default `1.5`) |
| `markerRadius` | Circle radius for point layers (default `6`) |
| `file` | Path to the GeoJSON file relative to project root |
| `nameKey` | Property name used for display names in the sidebar and popups |
| `singleFeature` | `true` if the file contains one logical feature (e.g. FRV statewide coverage); disables the feature list |
| `isSESFacilityGroup` | `true` only for SES facility layers that participate in zone-linking |
| `sesLinking` | Zone-to-facility linking config — leave `null` unless adding SES zones |
| `filter` | Named filter to apply to features — see filter list below |

**Available filters:**

| Filter name | Effect |
|-------------|--------|
| `ses_exclude_test` | Excludes features where `RESPONSE_ZONE_NAME` equals `"SES TEST STATION"` |

### Step 3 — Add a popup template (optional)

For point layers using the standard facility schema (`facility_name`, `facility_address`, etc.), the popup renders automatically. For polygon layers or custom schemas, add a `case` to the `buildPopup` function in `app.js`.

---

## Adding a new state or territory

Add a new top-level object to the array in `config/layers.json`:

```json
{
  "id": "NEW_STATE_CODE",
  "label": "State Full Name",
  "groups": []
}
```

Then add group entries following the field reference above.

---

## Data sources

All GeoJSON data is sourced from publicly available government datasets. Verify licensing for any dataset before adding it.

| Layer | Source |
|-------|--------|
| SES facilities (all states) | GA / PSMA Emergency Management dataset |
| VIC ambulance stations | Vic DELWP / Data Vic |
| VIC police stations | Vic DELWP / Data Vic |
| VIC CFA brigade areas | CFA / Data Vic |
| VIC FRV coverage | FRV / Data Vic |
| VIC SES response zones | VICSES / Data Vic |
| VIC flood overlays | DELWP / Data Vic |
| State boundaries | Australian Bureau of Statistics |
| Map tiles | © OpenStreetMap contributors (ODbL) |

---

## npm scripts

| Script | What it does |
|--------|-------------|
| `npm start` | Start local dev server on port 8080 |
| `npm run build` | Copy web assets to `www/` for Capacitor |
| `npm run cap:android` | Build and open Android Studio |
| `npm run cap:ios` | Build and open Xcode |
| `npm run cap:sync` | Build and sync to all native platforms |
| `npm run icons` | Regenerate PNG icons from `icons/icon.svg` |
