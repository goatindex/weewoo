# Feature Plan: Save / Load Map State

**Status:** Draft  
**Date:** 2026-05-11  
**Scope:** localStorage-first save/load for active layers and custom markers, with file export/import for sharing and a cloud-storage extension path.

---

## 0. Prerequisites and Caveats

### Custom markers do not exist yet

The current codebase has no custom marker creation UI. All features are loaded from static GeoJSON files in `geojson/`. This plan designs the save/load schema to accommodate custom markers, but a custom marker feature must be built first (or in parallel). Section 5 flags exactly where the two features couple.

### What "saving" means

WeeWoo does **not** save GeoJSON geometries in a save file. The GeoJSON boundary data lives in versioned static files served from GitHub Pages. A save file stores only:

- Which feature IDs are enabled (pointers into `state.featureEnabled` / `state.sesFlags`)
- Custom marker positions and popup content (user-authored data)
- Map view and UI preferences at save time

This keeps save files small (typically 20–100 KB) and avoids duplicating large GeoJSON files (the VIC SES zones file alone is 19 MB).

---

## 1. Data Model and Save File Schema

### 1.1 Top-level save envelope

```json
{
  "version": 1,
  "name": "mysave_20260511T143022Z",
  "createdAt": "2026-05-11T14:30:22Z",
  "layers": { ... },
  "customMarkers": [ ... ],
  "mapView": { ... },
  "ui": { ... }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `version` | integer | Schema version; currently `1`. Increment on breaking changes. |
| `name` | string | User-chosen prefix + `_` + Zulu datetime suffix (e.g. `mysave_20260511T143022Z`). Also serves as the localStorage key suffix. |
| `createdAt` | ISO 8601 string | UTC datetime of save creation, always Zulu (trailing `Z`). |
| `layers` | object | Mirror of the `weewoo_layers_v1` localStorage structure (see 1.2). |
| `customMarkers` | array | User-placed markers (see 1.3). Empty array if none or feature not yet built. |
| `mapView` | object | Map centre and zoom at save time (see 1.4). |
| `ui` | object | UI preferences at save time — basemap, sidebar side, text sizes (see 1.5). |

### 1.2 `layers` — enabled layer state

Mirrors the structure already serialized to `weewoo_layers_v1`:

```json
{
  "layers": {
    "enabled": {
      "VIC__ses_zones::0": true,
      "VIC__ses_zones::1": true,
      "VIC__cfa_brigades::42": true
    },
    "ses": {
      "VIC__ses_facilities::3": {
        "manualEnabled": false,
        "zoneEnabled": true
      }
    }
  }
}
```

- **`enabled`**: keys are feature IDs in `featureId(groupId, idx)` format (`${groupId}::${idx}`), values are always `true` (absent key = disabled). Sourced from `state.featureEnabled`.
- **`ses`**: SES facility dual-flag state. Sourced from `state.sesFlags`. Only entries where at least one flag is true are written.

**Size estimate:** With 500 enabled features across all layers, a feature ID averages ~25 characters. 500 entries as compact JSON ≈ 20–25 KB.

### 1.3 `customMarkers` — user-placed markers

> Stub for when the custom marker feature is built. The schema is defined here so save files are forward-compatible.

```json
{
  "customMarkers": [
    {
      "id": "marker_1746967822341",
      "lat": -37.8136,
      "lng": 144.9631,
      "title": "Staging Area Alpha",
      "popupHtml": "<b>Staging Area Alpha</b><p>Meet point for Strike Team 12</p>",
      "color": "#e94560",
      "createdAt": "2026-05-11T14:30:10Z"
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Client-generated unique ID: `marker_` + `Date.now()`. |
| `lat`, `lng` | number | WGS-84 decimal degrees. |
| `title` | string | Plain-text marker title shown in popup heading. |
| `popupHtml` | string | Full popup HTML. Sanitize on load (see §6 risks). |
| `color` | string | CSS hex color for marker icon. |
| `createdAt` | ISO 8601 string | UTC creation timestamp. |

**Size estimate:** 200–400 bytes per marker. 100 markers ≈ 30–40 KB.

### 1.4 `mapView` — viewport state

```json
{
  "mapView": {
    "center": [-37.8136, 144.9631],
    "zoom": 10
  }
}
```

Captured via `map.getCenter()` and `map.getZoom()` at save time. Restored via `map.setView()` on load. Optional: user can opt out of restoring view (e.g. a "load layers only" checkbox).

### 1.5 `ui` — interface preferences

```json
{
  "ui": {
    "basemap": "osm",
    "sidebarSide": "right",
    "sidebarTextSize": "M",
    "mapTextSize": "M"
  }
}
```

Sourced from the four localStorage preference keys already in use: `weewoo_basemap`, `weewoo_sidebar_side`, `weewoo_sidebar_text_size`, `weewoo_map_text_size`. On load, apply exactly as the existing restore functions do.

### 1.6 File format for export/import

Save files are exported as `.json`. MIME type: `application/json`. Filename matches the `name` field (e.g. `mysave_20260511T143022Z.json`). Files are valid JSON; no compression or binary encoding.

---

## 2. localStorage Approach and Its Limitations

### 2.1 Storage structure

Two localStorage key types:

| Key | Value | Purpose |
|-----|-------|---------|
| `weewoo_saves_index_v1` | JSON array of `{name, createdAt, byteSize, layerCount}` | Index of all saves; loaded on sidebar open to populate the save list without deserializing every save |
| `weewoo_save_{name}` | Full JSON save object | Individual save; key is e.g. `weewoo_save_mysave_20260511T143022Z` |

Separating the index from save bodies means the save list can be rendered cheaply (one small JSON parse), and individual saves are only deserialized when loaded.

Existing app keys (`weewoo_layers_v1`, `weewoo_basemap`, `weewoo_sidebar_text_size`, `weewoo_map_text_size`, `weewoo_sidebar_side`, `weewoo_sidebar_minimized`, `weewoo_onboarding_v2`) are unaffected.

### 2.2 Quota and realistic capacity

| Constraint | Detail |
|------------|--------|
| **Per-origin quota** | 5 MB on most browsers (Firefox default 10 MB; Safari 5 MB; Chrome 5 MB). Quota is scoped per origin (`scheme + hostname + port`), so `goatindex.github.io` has its own isolated bucket — unaffected by other `*.github.io` sites. |
| **Existing app usage** | The current 7 localStorage keys total roughly 5–15 KB (layer state for a heavily used session is the bulk). |
| **Typical save size** | 20–100 KB depending on how many layers are enabled and how many custom markers exist. A session with 200 enabled features and 10 custom markers ≈ 30 KB. |
| **Realistic save count** | At 30 KB/save and 4.9 MB available ≈ **160 saves**. At 100 KB/save (heavily used) ≈ **50 saves**. |
| **Worst case** | A user who enables every single feature ID across all states could produce a large enabled map. Rough upper bound: 2000 feature IDs × 30 bytes ≈ 60 KB. Still well within per-save limits. |

### 2.3 What happens when quota is exceeded

`localStorage.setItem()` throws a `QuotaExceededError` (a `DOMException`). The save code must catch this explicitly:

```javascript
try {
  localStorage.setItem(`weewoo_save_${name}`, JSON.stringify(saveObj));
  localStorage.setItem('weewoo_saves_index_v1', JSON.stringify(updatedIndex));
} catch (e) {
  if (e.name === 'QuotaExceededError') {
    // Surface a clear error to the user: "Storage full — delete old saves or export to file"
  }
}
```

The UI should show a clear error message pointing the user toward deleting old saves or switching to file export.

### 2.4 Other localStorage risks

- **Device and browser local:** localStorage is scoped to one browser on one device. A save made in Chrome on a laptop does not appear in Firefox on the same machine, in any browser on a different device, or after the user clears browser data / storage. Switching browsers or devices means losing access to saves. File export is the correct mechanism for portability across devices or users — not a workaround for a quota issue, but the fundamental way localStorage works.
- **Browser data loss:** clearing site data, "Clear browsing data", or a browser reset wipes all localStorage including saves. Users should be informed of this at save time ("Saves on this device may be lost if you clear browser data — export to file for a permanent copy").
- **No cross-user sharing:** two people cannot access each other's localStorage saves regardless of origin. File export/import is the only sharing mechanism for v1; cloud storage (§4) is the long-term answer.
- **Private/incognito mode:** Some browsers (Safari, older Firefox) either block localStorage writes silently or enforce a tiny quota in private mode. Saves must degrade gracefully to file-only mode.
- **No versioning:** If `config/layers.json` is updated (e.g. a feature is removed or an ID changes), old save files referencing the stale ID will silently skip those features on load. This is acceptable; see §6 (edge cases).

---

## 3. UI/UX Design

### 3.1 Save/load controls placement

Add two buttons to the existing sidebar footer (`#sidebar-footer` in `index.html`) alongside `btn-docs`, `btn-contact`, `btn-settings`, `btn-flip`, `btn-reset`:

- **`btn-save`** — floppy disk icon (or cloud-with-up-arrow). Tooltip: "Save current map state".
- **`btn-load`** — folder-open icon (or cloud-with-down-arrow). Tooltip: "Load or import a save".

The footer already uses 24×24px SVG icon buttons with `title` attributes for tooltips. Follow the same pattern.

### 3.2 Save dialog flow

Clicking `btn-save` opens a modal using the existing `openModal()` infrastructure. The modal content type is `'save'` (new case added to `openModal`).

**Save modal layout:**

```text
┌─────────────────────────────────────────┐
│  Save map state                    [✕]  │
├─────────────────────────────────────────┤
│  Save name                              │
│  ┌───────────────────────────────────┐  │
│  │ weewoosave                        │  │  ← text input, prefilled with default
│  └───────────────────────────────────┘  │
│  Full filename: weewoosave_20260511T143022Z  │  ← live preview, updates as user types
│                                         │
│  What's included:                       │
│  ✓ Active layers (247 features)         │
│  ✓ Custom markers (3)                   │
│  ✓ Map view (zoom 10, -37.81, 144.96)  │
│  ✓ UI preferences                       │
│                                         │
│  [Cancel]              [Save to device] │
└─────────────────────────────────────────┘
```

- **Name input:** plain text, max 64 chars, strip non-alphanumeric except `_-`. Default value: `weewoosave` (configurable; persist last-used prefix in `weewoo_save_prefix`).
- **Live preview:** show the full filename with Zulu suffix generated at dialog-open time (not at click time — avoids a race condition if the user pauses before saving).
- **"Save to device":** writes to localStorage. Button label changes to "Saving…" while serializing, then "Saved ✓" briefly before modal closes.
- **If localStorage full:** replace button row with an error banner: "Device storage full — [Export to file] instead or [Delete old saves]."

### 3.3 Load / manage saves dialog flow

Clicking `btn-load` opens the modal with type `'load'`.

**Load modal layout:**

```text
┌──────────────────────────────────────────────┐
│  Load map state                         [✕]  │
├──────────────────────────────────────────────┤
│  [Import from file…]                         │
│  ────────────────── Saved on this device ─── │
│                                              │
│  mysave_20260511T143022Z                     │
│  Sat 11 May 2026, 14:30 AEST · 247 layers   │
│  [Load]  [Export]  [Delete]                  │
│                                              │
│  weewoosave_20260510T091500Z                 │
│  Sun 10 May 2026, 09:15 AEST · 183 layers   │
│  [Load]  [Export]  [Delete]                  │
│                                              │
│  (no more saves)                             │
└──────────────────────────────────────────────┘
```

- **Import from file:** triggers `<input type="file" accept=".json">` (hidden, programmatically clicked). On file select, parse JSON, validate schema version, and offer to load or save-then-load.
- **Saved on this device:** renders from `weewoo_saves_index_v1`. Sorted newest-first.
- **Timestamps:** display in user's local timezone with IANA abbreviation (e.g. `AEST`). Store and export in UTC.
- **Layer count:** read from the index entry's metadata (computed at save time, stored in the index).
- **Load:** applies save to current app state (see §3.4). Asks "Replace current map state?" with [Cancel] / [Load] if any features are currently enabled.
- **Export:** generates and downloads the individual save as a `.json` file using the `URL.createObjectURL` / `<a download>` pattern (no server needed).
- **Delete:** shows inline confirmation "Delete this save?" [Cancel] [Delete] before removing.

### 3.4 Loading a save (state transition)

1. Call `clearLayerState()` (already exists, line 153 of `app.js`) to reset in-memory state.
2. Merge save's `layers.enabled` into `state.featureEnabled`.
3. Merge save's `layers.ses` into `state.sesFlags`.
4. Restore custom markers (clear existing, re-create from save).
5. Apply `ui` preferences (call the same setters already used by `restoreLayerState()`).
6. Call `saveLayerState()` to persist the newly loaded state to `weewoo_layers_v1`.
7. Restore `mapView` via `map.setView(center, zoom)`.
8. Re-render the sidebar checkboxes to reflect the new state. The existing `renderFeatureList()` per-group and the checkbox restoration logic in `ensureGroupLoaded()` handle this if called after state is set.
9. Walk `state.featureEnabled` and call `addLayerToMap()` for every enabled feature whose group is already loaded. For unloaded groups, the existing lazy-load + restore path in `ensureGroupLoaded()` handles activation automatically when the user expands that group.

### 3.5 Sharing saves (file export/import)

Saves are shared as `.json` files. The export workflow is entirely client-side:

```text
User clicks Export → generateSaveBlob(saveName) → URL.createObjectURL(blob) →
<a href=blobUrl download="mysave_20260511T143022Z.json">.click() → URL.revokeObjectURL()
```

Recipients import by clicking "Import from file…" in the Load modal, selecting the `.json` file, and loading it. Imported saves can optionally be persisted to their own localStorage under a new timestamped name.

### 3.6 URL-based sharing

Encodes active layer state into the URL hash fragment. Produces a plain URL the user can copy and share — no account, no storage, no server. Recipients open the link and are offered the option to load the shared state.

Format: `https://goatindex.github.io/weewoo/#share=<base64url(gzip(JSON))>`

#### What is encoded

Only `layers` (the `enabled` and `ses` objects from the save schema). Map view, UI prefs, and custom markers are deliberately excluded — the recipient sees the layers on their own current view.

#### Encoding process

```javascript
async function buildShareUrl(state) {
  const payload = JSON.stringify({ layers: buildLayersPayload(state) });
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(payload));
  writer.close();
  const compressed = await new Response(stream.readable).arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(compressed)));
  return `${location.origin}${location.pathname}#share=${encodeURIComponent(b64)}`;
}
```

`CompressionStream` is available in all modern browsers (Chrome 80+, Firefox 113+, Safari 16.4+). Graceful fallback for older browsers: skip compression, base64-encode the raw JSON — slightly longer URL, same behaviour.

#### Size estimates

| Active features | JSON size | After gzip | After base64 | URL length |
|----------------|-----------|------------|--------------|------------|
| 50             | ~1.3 KB   | ~200 B     | ~270 B       | ~300 chars |
| 200            | ~5 KB     | ~500 B     | ~670 B       | ~700 chars |
| 500            | ~12 KB    | ~900 B     | ~1.2 KB      | ~1.3 KB    |

All within safe URL length limits for modern browsers and messaging apps (SMS, WhatsApp, Slack, email).

#### On-load detection

At app init, check `location.hash` for `#share=`. If found, decode and offer a dismissible banner:
> "Someone shared a WeeWoo map with you. [Load shared layers] [Dismiss]"

Clicking Load calls `applySave()` with `{ restoreView: false, restoreUi: false }` (layers only). The `#share=` fragment is cleared from the URL after loading to avoid re-triggering on reload.

#### UI entry point

Add a "Copy share link" button to the save modal (§3.2) alongside "Save to device". Clicking it calls `buildShareUrl()` and writes the result to the clipboard (`navigator.clipboard.writeText`), then briefly changes the button label to "Copied ✓".

Optionally also add `btn-share` to `#sidebar-footer` as a standalone icon for users who want to share without saving.

#### What's included callout (required in UI)

Wherever the share link is generated — whether in the save modal or a standalone share modal — display a plain-language summary of exactly what is and is not in the link. This must appear before the user copies the link, not buried in docs:

```text
┌──────────────────────────────────────┐
│  Share link includes:                │
│  ✓ Active layers (247 features)      │
│                                      │
│  Not included:                       │
│  ✗ Custom markers                    │
│  ✗ Map position and zoom             │
│  ✗ Basemap and display preferences   │
│                                      │
│  Anyone with the link can open it    │
│  in WeeWoo — no account needed.      │
│                                      │
│  [Copy link]                         │
└──────────────────────────────────────┘
```

The layer count ("247 features") is derived from `Object.keys(state.featureEnabled).filter(k => state.featureEnabled[k]).length` at share-time. The "Not included" list is static — always show all three exclusions regardless of context, so there is no ambiguity.

#### Risks and edge cases

- **Stale feature IDs:** same as §6 — silently skip unknown IDs on load.
- **Tampering/XSS:** the payload contains only feature IDs (strings matched against `config/layers.json`) — no HTML, no eval. No sanitization needed beyond unknown-ID skipping.
- **`CompressionStream` unavailable:** fall back to uncompressed base64.
- **Name collision with `#` anchors:** the `#share=` prefix is unique; no existing anchor in `index.html` starts with `share`.

---

## 4. Cloud Storage Integration Plan

### 4.1 Storage backend abstraction

Define a common interface (plain JS module, not a class) so localStorage and cloud backends are interchangeable:

```javascript
// save-backends.js — plain global script, no ES modules (app.js is not a module)
window.SaveBackends = {
  LocalStorageBackend: {
    async listSaves() { ... },        // → [{name, createdAt, byteSize, layerCount}]
    async loadSave(name) { ... },     // → saveObject | null
    async writeSave(name, saveObj) { ... }, // → void, throws QuotaExceededError
    async deleteSave(name) { ... },   // → void
    label: 'This device',
    id: 'local',
  },
  GoogleDriveBackend: { /* same interface */ },
  OneDriveBackend:    { /* same interface */ },
  DropboxBackend:     { /* same interface */ },
};
```

The load/save UI passes the currently selected backend to each operation. Backends are listed in a "Storage:" selector in the load modal header.

### 4.2 Google Drive

- **API:** [Google Drive REST API v3](https://developers.google.com/drive/api/v3/reference) — specifically the Files resource (`files.create`, `files.list`, `files.get`, `files.delete`).
- **OAuth:** Google Identity Services (`accounts.google.com/gsi/client`). Use PKCE Authorization Code flow via `google.accounts.oauth2.initCodeClient` — the GSI library handles PKCE transparently. Do not use the implicit grant flow (`response_type=token`); Google has deprecated it for new apps. Scopes: `https://www.googleapis.com/auth/drive.appdata` (app-private folder, not visible in user's Drive root — preferred for minimal footprint) or `drive.file` (user-visible files).
- **File organisation:** saves stored in the `appDataFolder` space. Each save is a Drive file named `{name}.json` with MIME type `application/json`.
- **Client ID:** requires a Google Cloud project with the Drive API enabled and an OAuth 2.0 client ID (Web Application type). The client ID is a compile-time config constant — not a secret.
- **Token storage:** access token stored in sessionStorage only (not localStorage) to avoid stale tokens. Refresh via silent token renewal (`prompt: 'none'`) on next open.

### 4.3 OneDrive / Microsoft Graph

- **API:** [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/resources/driveitem) — `PUT /me/drive/special/approot:/{name}.json:/content` for write, `GET /me/drive/special/approot/children` for list.
- **OAuth:** MSAL.js (Microsoft Authentication Library for browsers). Scopes: `Files.ReadWrite.AppFolder`. Uses the `approot` special folder — visible to user as "Apps/WeeWooMap/" in OneDrive.
- **Client ID:** Azure App Registration (Single-Page Application type).

### 4.4 Dropbox

- **API:** Dropbox API v2 via direct `fetch` calls — no SDK dependency.
  - List: `POST https://api.dropboxapi.com/2/files/list_folder` with `{"path": "/Apps/WeeWoo"}`
  - Read: `POST https://content.dropboxapi.com/2/files/download` with `Dropbox-API-Arg` header
  - Write: `POST https://content.dropboxapi.com/2/files/upload` with `Dropbox-API-Arg` header
  - Delete: `POST https://api.dropboxapi.com/2/files/delete_v2`
- **OAuth:** PKCE Authorization Code flow. Endpoint: `https://www.dropbox.com/oauth2/authorize`. Scopes: `files.content.read files.content.write`. Redirect URI: GitHub Pages origin.
- **App registration:** Dropbox App Console — create app with "Scoped access" and "App folder" permission type. The App key is a public value (safe to ship in client-side JS).
- **File organisation:** saves stored as `{name}.json` in the app's dedicated `/Apps/WeeWoo/` folder — only visible to the app, not in the user's Dropbox root.
- **Token storage:** access token in `sessionStorage` only; refresh token (if requested with `token_access_type=offline`) in `localStorage` behind a user opt-in.
- **PKCE redirect flow note:** unlike Drive and OneDrive (which support popup-based auth), Dropbox PKCE uses a redirect. The app must handle the `?code=` query param at startup and complete the token exchange before initialising normally. Store the PKCE verifier in `sessionStorage` before redirecting.
- **Fits the existing backend abstraction** from §4.1 with no interface changes.

### 4.5 Integration milestones

1. Define and wire `LocalStorageBackend` behind the interface — no user-visible change, just refactor.
2. Add "Storage:" selector to load modal (disabled until cloud backends exist).
3. Implement `GoogleDriveBackend` gated behind a feature flag (URL param `?cloud=1` or settings toggle).
4. Implement `DropboxBackend` (lazy-loads auth via PKCE redirect; no external SDK).
5. Implement `OneDriveBackend` similarly.
6. Add backend selector to settings modal (persisted in `weewoo_storage_backend`).

---

## 5. Implementation Plan

Steps are ordered; each step is independently shippable.

### Step 1 — Save file serialization (`app.js`)

**Files:** `app.js`  
**New functions:**

```text
buildSaveObject(name)     → creates the full save envelope from current state
parseSaveObject(json)     → validates schema version, returns save object or throws
formatSaveName(prefix)    → prefix + '_' + toZuluSuffix(new Date())
toZuluSuffix(date)        → '20260511T143022Z' format
```

`buildSaveObject` reads from:

- `state.featureEnabled` — existing global
- `state.sesFlags` — existing global
- `map.getCenter()`, `map.getZoom()` — existing Leaflet map reference
- `state.customMarkers` — **new global** (empty array until marker feature is built; see coupling note below)
- `localStorage.getItem('weewoo_basemap')`, etc. for UI prefs

**Coupling with custom markers:** `state.customMarkers` must be an array defined at app initialisation (even if always empty initially). When the custom marker feature is built, it populates this array and the save/load system automatically includes markers. No further changes needed to the save/load code.

### Step 2 — localStorage backend (`save-backends.js`, new file)

**Files:** `save-backends.js` (new)  
Implement `LocalStorageBackend` with `listSaves`, `loadSave`, `writeSave`, `deleteSave`. Handle `QuotaExceededError` in `writeSave`. Import and use in `app.js`.

### Step 3 — Load/apply save (`app.js`)

**Files:** `app.js`  
**New function:** `applySave(saveObject, opts = {restoreView: true, restoreUi: true})`

Flow:

1. `clearLayerState()` (line 153)
2. Merge `saveObject.layers.enabled` into `state.featureEnabled`
3. Merge `saveObject.layers.ses` into `state.sesFlags`
4. Call `saveLayerState()` (line 129)
5. Apply `saveObject.ui` prefs (call existing setters)
6. Walk all loaded groups, call `addLayerToMap` for every enabled feature whose group is already loaded (`clearLayerState()` in step 1 already removed all active layers — no remove pass needed)
7. Clear and restore `state.customMarkers` (stub until marker feature exists)
8. If `restoreView`: `map.setView(saveObject.mapView.center, saveObject.mapView.zoom)`

### Step 4 — Save modal UI (`index.html`, `style.css`, `app.js`)

**Files:** `index.html`, `style.css`, `app.js`

- Add `btn-save` to `#sidebar-footer` in `index.html`
- Add `'save'` key to the `MODAL_CONTENT` map in `app.js`; add `'save'` to the `titles` and `btnIds` objects inside `openModal()` (the function uses a map lookup, not a switch)
- Add modal content builder `buildSaveModalContent()` returning HTML string
- Handle name input validation, live preview update, save button click
- Add modal styles to `style.css` (reuse existing modal panel styles; add save-specific input and summary list styles)

### Step 5 — Load modal UI (`index.html`, `style.css`, `app.js`)

**Files:** `index.html`, `style.css`, `app.js`

- Add `btn-load` to `#sidebar-footer`
- Add `case 'load':` to `openModal()`
- Build save list from `LocalStorageBackend.listSaves()`, render save entries
- Wire Load / Export / Delete buttons per entry
- Wire "Import from file" to a hidden `<input type="file">` element appended to `#app`
- Add file-import parsing using `FileReader` → `parseSaveObject()` → `applySave()`

### Step 6 — File export (`app.js`)

**Files:** `app.js`  
**New function:** `exportSaveFile(saveObject)`

```javascript
function exportSaveFile(saveObj) {
  const blob = new Blob([JSON.stringify(saveObj, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${saveObj.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Step 7 — Google Drive and OneDrive backends (`save-backends.js`, `app.js`, `index.html`)

**Files:** `save-backends.js`, `app.js`, `index.html`

- Implement `GoogleDriveBackend` (lazy-loads GSI library)
- Implement `OneDriveBackend` (lazy-loads MSAL)
- Add backend selector to load modal
- Add OAuth connect/disconnect UI to settings modal
- Persist selected backend to `weewoo_storage_backend` in localStorage

### Step 7b — Dropbox backend (`save-backends.js`, `app.js`, `index.html`)

**Files:** `save-backends.js`, `app.js`, `index.html`

Implement `DropboxBackend` using direct `fetch` calls to Dropbox API v2. PKCE OAuth via redirect (no popup — no external SDK required):

- Generate code verifier + challenge at auth initiation; store verifier in `sessionStorage`; redirect to `https://www.dropbox.com/oauth2/authorize`
- On app startup, if `?code=` is present in the URL: exchange for access token, remove `?code=` from URL via `history.replaceState`, then continue normal init
- Access token stored in `sessionStorage` only; refresh token in `localStorage` behind a user opt-in ("Keep me signed in")

### Step 8 — URL sharing (`app.js`, `index.html`, `style.css`)

**Files:** `app.js`, `index.html`, `style.css`  
**New functions:** `buildShareUrl(state)`, `decodeShareUrl(hash)`, `initShareDetection()`

- `buildShareUrl`: encodes `state.featureEnabled` + `state.sesFlags` via `CompressionStream` → gzip → base64; returns the full URL with `#share=` fragment
- `decodeShareUrl`: inverse of above; returns a layers-only save object suitable for `applySave()`
- `initShareDetection`: called in `initApp()` before `restoreLayerState()`; checks `location.hash` for `#share=`; if found, defers a load banner until after the map is fully initialised
- Add "Copy share link" button and what's-included callout to the save modal (§3.2 and §3.6)
- Clear `#share=` from URL after loading via `history.replaceState`
- Optionally add `btn-share` to `#sidebar-footer` in `index.html`

---

## 6. Edge Cases and Risks

### Stale feature IDs

`config/layers.json` may change between save creation and load. A saved feature ID like `NSW__ambulance::142` may no longer exist if the GeoJSON file is rebuilt with fewer features or the group is renamed. **Mitigation:** silently skip unknown IDs during `applySave()` (mirror the existing `restoreLayerState()` behavior at line 141). Log skipped IDs to `console.warn` for debugging.

### Schema version mismatch

Future schema changes (e.g. adding a field, changing ID format) are handled by `parseSaveObject()` checking `version`. If `version > 1` (unknown version), show a warning: "This save was created with a newer version of WeeWoo. Some features may not restore correctly." If `version < 1`, attempt migration or reject with a clear error.

### XSS via imported save files

`customMarkers[].popupHtml` is user-authored HTML. If a malicious `.json` file is imported, it could inject scripts via popups. **Mitigation:** sanitize `popupHtml` with DOMPurify (already a CDN-loadable dependency with no build step required) before inserting into the DOM. `title` fields are treated as plain text only.

### localStorage full on save

Caught explicitly as `QuotaExceededError`. UI surfaces an actionable error with two options: delete old saves, or export to file. Never silently fail.

### Private/incognito mode

`localStorage.setItem()` may throw or write to a throwaway store. Detect at startup: attempt a test write/read/delete. If it fails, disable localStorage saves and show a banner: "Device storage unavailable — use file export to save your map state."

### Concurrent tabs

Two browser tabs sharing the same origin may both write to `weewoo_saves_index_v1` simultaneously. The last writer wins, potentially losing an index entry. **Mitigation:** re-read the index from localStorage immediately before writing (i.e., read → merge → write, not cache → write). A `storage` event listener can detect external changes and refresh the save list in the UI.

### Very large custom marker popup content

If a user pastes a large document into a marker popup (hypothetically), a single marker could be very large. **Mitigation:** cap `popupHtml` at 10 KB in the marker creation UI (separate from save/load). The save code does not enforce this cap — it is the marker UI's responsibility.

### Restore order and group-not-yet-loaded

`applySave()` sets `state.featureEnabled` before groups are loaded. Enabled state for unloaded groups is automatically applied when the group is lazy-loaded via `ensureGroupLoaded()` (line 645 of `app.js`), which already calls `renderFeatureList()` and restores checked state. No special handling needed — the existing deferred-load path handles it.

### `name` collision

If the user saves with the same prefix at the same second (possible if the datetime is truncated to seconds), the new save would overwrite the old one in localStorage. `weewoo_save_{name}` would be silently replaced, and the index would update the existing entry. This is acceptable behavior but should be noted in the UI: "A save with this name already exists — it will be overwritten."

### Browser data cleared unexpectedly

A user may not realise that "Clear browsing data" or clearing site storage deletes their localStorage saves. **Mitigation:** display a one-time notice when the user creates their first save: "Saves on this device may be lost if you clear browser data. Export to file for a permanent copy." The notice is dismissible and its shown-state is tracked in a `weewoo_save_notice_v1` localStorage flag (small, single-character value).

---

## 7. Out of Scope (for this feature)

- **Custom marker creation UI** — required before custom markers can be saved; tracked separately.
- **Save merging** — loading a save replaces current state; partial merge is deferred.
- **Collaborative/realtime sharing** — not planned; file export covers the sharing case.
- **Undo after load** — reverting to pre-load state requires an additional "current state" save; out of scope for v1.
- **Compression for saves** — save files are plain JSON; gzip is not applied. `CompressionStream` is already used for URL sharing (§3.6), so applying it to file saves would be a small addition if sizes grow in a future iteration.
