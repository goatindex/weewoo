# Data Retrieval & Transformation Notes

How each file was obtained and processed. Use this when re-acquiring or updating a dataset.

---

## Common Patterns

### ArcGIS REST API — GeoJSON query

The general query pattern for any ArcGIS MapServer or FeatureServer layer:

```text
{serviceUrl}/{layerId}/query?where=1%3D1&outFields=*&f=geojson
```

Key parameters:

- `where=1%3D1` — return all features (`1=1` URL-encoded)
- `outFields=*` — all fields; use comma-separated field names to reduce payload size
- `resultOffset={n}&resultRecordCount={n}` — pagination (required when feature count exceeds server limit)
- `f=geojson` — GeoJSON output (some servers also support `f=json` Esri JSON)

Check `maxRecordCount` before downloading:

```text
{serviceUrl}/{layerId}?f=json   # look for "maxRecordCount" in response
```

Check total feature count before paginating:

```text
{serviceUrl}/{layerId}/query?where=1%3D1&returnCountOnly=true&f=json
```

### ArcGIS REST API — pagination (Python)

```python
import urllib.request, json, time

base_url = '{serviceUrl}/{layerId}/query'
all_features = []
offset = 0
batch = 500  # conservative; use up to maxRecordCount if server is reliable

while True:
    url = f'{base_url}?where=1%3D1&outFields=FIELD1,FIELD2&resultOffset={offset}&resultRecordCount={batch}&f=geojson'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    data = json.loads(urllib.request.urlopen(req, timeout=30).read())
    feats = data.get('features', [])
    all_features.extend(feats)
    if len(feats) < batch:
        break
    offset += batch
    time.sleep(0.5)  # be polite

out = {'type': 'FeatureCollection', 'features': all_features}
with open('output.geojson', 'w') as f:
    json.dump(out, f, separators=(',', ':'))
```

### curl — single-request GeoJSON download

```bash
curl -sL "{url}" -o output.geojson
```

Use `-sL` to follow redirects silently. Required for GA MapServer (redirects HTTP → HTTPS).

### Shapefile → GeoJSON (geopandas)

```python
import geopandas as gpd

gdf = gpd.read_file('path/to/file.shp')
gdf_wgs84 = gdf.to_crs(epsg=4326)  # reproject to WGS84 if needed
gdf_wgs84.to_file('output.geojson', driver='GeoJSON')
```

`fiona` and `geopandas` are available in this environment (`python -c "import geopandas"` to confirm).

### Adding a metadata block

After saving a GeoJSON, add the standard `metadata` object at the FeatureCollection root:

```python
import json

with open('output.geojson') as f:
    d = json.load(f)

d['metadata'] = {
    'title': 'Human-readable title',
    'source': 'Organisation — Service name',
    'source_url': 'https://...',
    'licence': 'CC BY 4.0',
    'attribution': 'Attribution text for display',
    'notes': 'Any derivation, vintage, or field notes.',
}

with open('output.geojson', 'w') as f:
    json.dump(d, f, separators=(',', ':'))
```

---

## National Datasets

### Digital Atlas — SES Facilities (`SESBLD_*.geojson`)

**Service:** `https://digital.atlas.gov.au/datasets/state-emergency-services-facilities`
**How acquired:** Downloaded the national GeoJSON from the Digital Atlas, then split by state using Python filtering on the `state` field. Files named `SESBLD_{STATE_UPPER}.geojson`.

**To re-acquire:** Download the national dataset from Digital Atlas, then split:

```python
import json

with open('national_ses.geojson') as f:
    d = json.load(f)

states = {}
for feat in d['features']:
    state = feat['properties'].get('state', 'UNKNOWN').upper().replace(' ', '_')
    states.setdefault(state, []).append(feat)

for state, feats in states.items():
    with open(f'{state}.geojson', 'w') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f, separators=(',', ':'))
```

### Digital Atlas — Ambulance Stations (`ambulance_*.geojson`)

**Service:** `https://digital.atlas.gov.au/datasets/ambulance-stations`
**How acquired:** Same approach as SES Facilities — downloaded national dataset and split by state. The per-state files are named `ambulance_{state_abbrev}.geojson`.
`VIC/ambulance_backup.geojson` is the unsplit national file kept as a backup.

### Digital Atlas — Police Stations (`VIC/police.geojson`)

**Service:** `https://digital.atlas.gov.au/datasets/police-stations`
**How acquired:** Downloaded VIC subset only.

### Geoscience Australia — LGA Council Offices (`lga_facilities.geojson`)

**Service:** `https://services.ga.gov.au/gis/rest/services/Local_Government_Area_Council_Offices/MapServer/0`
**Licence:** CC BY 4.0, vintage 2018
**Filter by state:** `where=state%3D%27{State Name}%27` (URL-encode single quotes as `%27`)
**State names in dataset:** New South Wales, Northern Territory, Queensland, South Australia, Tasmania, Victoria, Western Australia — **ACT is absent**

```bash
curl -sL "https://services.ga.gov.au/gis/rest/services/Local_Government_Area_Council_Offices/MapServer/0/query?where=state%3D%27Queensland%27&outFields=*&f=geojson" -o lga_facilities.geojson
```

**Quirk:** The HTTP URL (port 80) returns HTML — always use HTTPS. The `-sL` curl flag handles the redirect automatically.

**Key fields:** `name` (facility name), `state`, `localgovernmentarea_lga`, `class`, `operationalstatus`, `address`, `suburb`

---

## LGA Boundaries (`LGAs.geojson` — all states except VIC)

**Service:** `https://geo.abs.gov.au/arcgis/rest/services/ASGS2024/LGA/MapServer`
**Layer:** 1 (LGA_GEN — generalised boundaries; use this rather than the detailed layer for reasonable file sizes)
**Licence:** CC BY 4.0, ABS
**Name field:** `lga_name_2024`
**Filter by state:** `where=STATE_NAME_2021%3D%27{State Name}%27`

```bash
# Example: NSW
curl -sL "https://geo.abs.gov.au/arcgis/rest/services/ASGS2024/LGA/MapServer/1/query?where=STATE_NAME_2021%3D%27New+South+Wales%27&outFields=*&f=geojson" -o NSW/LGAs.geojson
```

State names: `New South Wales`, `Victoria`, `Queensland`, `South Australia`, `Western Australia`, `Tasmania`, `Northern Territory`, `Australian Capital Territory`

**Note:** VIC uses the higher-resolution Geoscape dataset (see below) rather than this service.

---

## Victoria

### `VIC/LGAs.geojson` — Geoscape Administrative Boundaries

**Source:** `https://data.gov.au/data/dataset/vic-local-government-areas-geoscape-administrative-boundaries`
**Acquired:** Downloaded as GeoJSON from data.gov.au. Higher resolution than ABS ASGS.
**Name field:** `LGA_NAME`

### `VIC/cfa.geojson` — CFA Brigade Areas

**Service:** `https://emapdev.ffm.vic.gov.au/arcgis/rest/services/vsw_boundaries/MapServer/6`
**Pagination:** Required — 1,000 features per request, ~1,172 total. Use `resultOffset` loop.
**Name field:** `BRIG_NAME`

### `VIC/cfabld.geojson` — CFA Buildings (source file)

**Source:** `https://discover.data.vic.gov.au/dataset/cfa-fire-station-vmfeat-geomark_point`
**How acquired:** Downloaded complete source file (1,291 features). Keep this as-is; derived files are split from it.
**Key fields:** `brig_name`, `fs_type` (main / satellite), `street`, `suburb`, `pcode`, `distrct_label`

### `VIC/cfa_brigade_bld.geojson`, `VIC/cfa_district_bld.geojson`, `VIC/cfa_coastguard_bld.geojson`

**Source:** Derived from `VIC/cfabld.geojson`

| File | Filter |
|------|--------|
| `cfa_brigade_bld.geojson` | `fs_type == 'main'` AND `brig_name` does not contain 'Headquarters', 'Coast Guard' |
| `cfa_district_bld.geojson` | `brig_name` contains 'Headquarters' |
| `cfa_coastguard_bld.geojson` | `brig_name` contains 'Coast Guard' |

### `VIC/frv.geojson` — FRV Coverage

**Source:** `https://discover.data.vic.gov.au/dataset/vicmap-admin-fire-rescue-victoria-frv-legislated-boundary-polygon`
**How acquired:** Direct download.

### `VIC/ses.geojson` and `VIC/ses.with_hq.geojson` — VIC SES Zones

**Source:** `https://discover.data.vic.gov.au/dataset/vicmap-admin-emergency-management-region-polygon`
**`ses.with_hq.geojson`:** Derived from `ses.geojson` with three extra properties added per feature: `HQ_LON`, `HQ_LAT`, `HQ_FACILITY_NAME` — joined from `sesbld.geojson` by name matching.
Three features removed: 1× `SASES DUTY OFFICER`, 2× `NSWSES DUTY OFFICER` (out-of-state entries).
**Name field:** `RESPONSE_ZONE_NAME`

### `VIC/municipal_offices.geojson` — LGA Facilities (VIC)

**Source:** Vicmap Features of Interest FeatureServer Layer 1
`https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/arcgis/rest/services/Vicmap_Features_of_Interest/FeatureServer/1`
**Filter:** `feature_subtype='municipal office'`
**Transformation:**

1. Downloaded 145 features covering VIC + some NSW border-region councils
2. 27 NSW councils split to `NSW/municipal_offices.geojson`
3. `weewoo_role` field added: `"COUNCIL HQ"` or `null`, determined by web research per council
**Name field:** `name`

---

## New South Wales

### `NSW/municipal_offices.geojson`

Split from `VIC/municipal_offices.geojson` — 27 border-region NSW council offices that appeared in the Vicmap dataset. Has `weewoo_role` field.

### `NSW/lga_facilities.geojson`

GA Council Offices MapServer, `state='New South Wales'`. 167 features, vintage 2018.

### `NSW/LGAs.geojson`

ABS ASGS 2024 Layer 1, filter `STATE_NAME_2021='New South Wales'`. 131 LGAs.

### `NSW/ses_zones.geojson`, `ses_clusters.geojson`, `ses_units.geojson`, `ses_hq.geojson`

**Service:** `https://services1.arcgis.com/ote4BhoDTJeZCJbh/arcgis/rest/services/SES_HQs_Boundaries/FeatureServer`
**Found via:** ArcGIS search — `https://www.arcgis.com/sharing/rest/search?q=owner:nswses.gis+type:Feature+Service&f=json`
**Licence:** Not explicitly stated; published publicly by NSW SES Map Centre (`mapcentre-nswses.hub.arcgis.com`)

| Layer ID | File | Name field | Features |
|---|---|---|---|
| 0 | `ses_hq.geojson` | `HQNAME` | 261 |
| 1 | `ses_zones.geojson` | `ZONENAME` | 7 |
| 2 | `ses_clusters.geojson` | `CLUSTERNAME` | 62 |
| 3 | `ses_units.geojson` | `UNITNAME` | 234 |

All fit in a single request (no pagination needed). `ses_units.geojson` is ~32MB due to detailed geometry.

---

## Queensland

### `QLD/rfs_brigades.geojson` — RFS Brigade Areas

**Service:** `https://gisext.qfes.qld.gov.au/arcgis/rest/services/Foundation/QFES_Boundaries/MapServer/3`
**Layer name:** Rural Fire Brigades
**Licence:** CC BY 4.0 (via data.qld.gov.au)
**⚠️ Quirk — pagination required:** Server `maxRecordCount` is 2,000 but GeoJSON requests time out with large geometry payloads. Use batches of **500 features** with `outFields` restricted to needed fields only.

```python
# Use the paginated Python snippet in "Common Patterns" above
# with batch=500 and outFields=BRIGADE_NAME,BRIGADE_ID,RURAL_AREA
```

**⚠️ Quirk — direct ZIP download broken:** The data.qld.gov.au ZIP download link (`https://www.qfes.qld.gov.au/opendata/QFESBrigadeBoundaries.zip`) has been 404 since at least August 2024. Use the ArcGIS service directly.
**Name field:** `BRIGADE_NAME`

### `QLD/rfs_stations.geojson` — RFS Station Points

**Source:** QFD Open Data Portal — Rural Fire Stations dataset
**⚠️ Quirk — CSV URL gated:** The published CSV URL (`https://www.fire.qld.gov.au/opendata/RuralFireStations.csv`) returns HTML (requires login). Use the **CKAN datastore API** instead:

```python
import urllib.request, json

base = 'https://www.data.qld.gov.au/api/3/action/datastore_search?resource_id=e09d0d06-b13e-4e52-b82d-1ce0cf05927c'
all_records = []
offset = 0

while True:
    url = f'{base}&limit=100&offset={offset}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    data = json.loads(urllib.request.urlopen(req, timeout=15).read())
    records = data.get('result', {}).get('records', [])
    all_records.extend(records)
    if len(records) < 100:
        break
    offset += 100

features = [{
    'type': 'Feature',
    'geometry': {'type': 'Point', 'coordinates': [float(r['LONG_GDA20']), float(r['LAT_GDA20'])]},
    'properties': {'name': r['STATION'], 'address': r['ADDRESS'], 'locality': r['LOCALITY']}
} for r in all_records if r.get('LONG_GDA20')]
```

**Coordinate system:** GDA2020 (`LONG_GDA20`, `LAT_GDA20`) — treated as WGS84 (offset is submetre, negligible for display).
**Name field:** `name` (station name)

### `QLD/ses_areas.geojson` — SES Areas

**Service:** `https://gisext.qfes.qld.gov.au/arcgis/rest/services/Foundation/QFES_Boundaries/MapServer/7`
**Layer name:** SES Areas. 21 features, single request (no pagination needed).
**Name field:** `SES_Area`

### Other QFES MapServer layers (available but not currently wired)

| Layer ID | Name |
|---|---|
| 0 | Station Administrative Boundaries |
| 1 | QFES Area Commands |
| 2 | Fire Warden Districts |
| 4 | Rural Groups |
| 8 | SES Regions |
| 9 | Disaster Districts |

---

## Northern Territory

### `NT/volunteer_brigade_areas.geojson`, `NT/darwin_volunteer_brigades.geojson`, `NT/emergency_response_areas.geojson`, `NT/fire_management_zones.geojson`, `NT/fire_protection_zones.geojson`

**Source:** NTG Open Data Portal — Bushfire NT Administration Boundaries
**ZIP URL:** `https://ftp-dlrm.nt.gov.au/main.html?download&weblink=57e0335bca8199b13f80fbb04ff36dd9&realfilename=Bushfires_Boundaries.zip`
**Vintage:** June 2021 (check data.nt.gov.au for updates)
**Original CRS:** GDA1994 (EPSG:4283) — must reproject to WGS84

**Transformation pipeline:**

```python
import zipfile, geopandas as gpd

# 1. Download ZIP
# curl -sL "{ZIP_URL}" -o Bushfires_Boundaries.zip

# 2. Extract
with zipfile.ZipFile('Bushfires_Boundaries.zip') as z:
    z.extractall('extracted/')

# 3. Convert each shapefile
import os
shp_dir = 'extracted/Boundaries/Datasets/ESRI/Bushfires_NT/'
ntfrs_dir = 'extracted/Boundaries/Datasets/ESRI/NTFRS/'

files = {
    'volunteer_brigade_areas': (shp_dir, 'Volunteer_Bushfire_Brigade_Areas.shp'),
    'fire_management_zones':   (shp_dir, 'Fire_Management_Zones.shp'),
    'fire_protection_zones':   (shp_dir, 'Fire_Protection_Zones.shp'),
    'darwin_volunteer_brigades': (ntfrs_dir, 'Darwin_Volunteer_Brigade_Areas.shp'),
    'emergency_response_areas':  (ntfrs_dir, 'Emergency_Response_Areas.shp'),
}

for name, (dir_, shp) in files.items():
    gdf = gpd.read_file(os.path.join(dir_, shp))
    gdf.to_crs(epsg=4326).to_file(f'NT/{name}.geojson', driver='GeoJSON')
```

**Name fields:**

- `volunteer_brigade_areas`: `GAZ_NAME` (formal gazetted name)
- `darwin_volunteer_brigades`: `GAZ_NAME` is null — use `SHORT_NAME`
- `emergency_response_areas`: `GAZ_NAME`
- `fire_management_zones`, `fire_protection_zones`: `GAZ_NAME`

**⚠️ Note:** An ArcGIS FeatureServer also exists (`services.arcgis.com/v2qv5kPkL9VBA7IF/ArcGIS/rest/services/NTFRS_Boundaries_WFL1/FeatureServer/8`) but requires token authentication. Use the ZIP download instead.

---

## Western Australia

### `WA/frs_districts.geojson` — DFES Fire and Rescue Services Districts

**Service:** `https://services.slip.wa.gov.au/public/rest/services/SLIP_Public_Services/Boundaries/MapServer/3`
**⚠️ Quirk — two different URLs:** The data.wa.gov.au download link (`https://data-downloads.slip.wa.gov.au/DFES-016/GeoJSON`) **requires a free SLIP account login**. The ArcGIS REST service at `services.slip.wa.gov.au/public/...` is **publicly accessible without login**.

```bash
curl -sL "https://services.slip.wa.gov.au/public/rest/services/SLIP_Public_Services/Boundaries/MapServer/3/query?where=1%3D1&outFields=*&f=geojson" -o WA/frs_districts.geojson
```

**Name field:** `name`

### `WA/dfes_stations.geojson` — DFES Stations

**Service:** `https://public-services.slip.wa.gov.au/public/rest/services/SLIP_Public_Services/Infrastructure_and_Utilities/MapServer/33`
**Note:** Different subdomain (`public-services` vs `services`) — both are public.

```bash
curl -sL "https://public-services.slip.wa.gov.au/public/rest/services/SLIP_Public_Services/Infrastructure_and_Utilities/MapServer/33/query?where=1%3D1&outFields=*&f=geojson" -o WA/dfes_stations.geojson
```

**Name field:** `displaynam` (truncated — original field is `displayname`, but ArcGIS truncated it to 10 chars in the shapefile schema). `type` contains station type.

**⚠️ Volunteer Bush Fire Brigades:** WA's ~500 volunteer brigades are managed by ~130 local councils under the Bushfires Act. There is no centralised spatial dataset — they are not available as open data.

---

## Tasmania

### `TAS/fire_stations.geojson` and `TAS/ses_offices.geojson`

**Service:** `https://services.thelist.tas.gov.au/arcgis/rest/services/Public/EmergencyManagementPublic/MapServer`
**Licence:** CC BY 3.0 AU

| Layer ID | File | Name field |
|---|---|---|
| 6 | `fire_stations.geojson` | `BRIGADE` |
| 7 | `ses_offices.geojson` | `SITE_NAME` |

Both fit in a single request. Layer 8 (Ambulance Tasmania Station Primary Response Area) and Layer 9 (Ambulance Tasmania Regions) are also available as polygons if needed in future.

**⚠️ Brigade boundaries not available via REST:** TFS brigade boundary polygons are displayed in LISTmap (the interactive viewer) but are not served through the public `EmergencyManagementPublic` or `OpenDataWFS` REST services. They may be served as WMS/WMTS only.

---

## South Australia

No fire brigade or SES zone boundaries are published as open data:

- **CFS (Country Fire Service)** brigade boundaries: not published. Only large-scale "Bushfire Management Areas" are available (data.sa.gov.au), which are regional committee areas, not individual brigade footprints.
- **SA SES** zone boundaries: not found in any public service.

---

## Australia — National Boundaries

### `au.json`

**Source:** simplemaps.com — state and territory boundary polygons.
Downloaded directly; no transformation applied. Licence: free for personal and commercial use.

---

## Victoria — Flood Data

### Melbourne Water flood polygons (`VIC/flood/melbwater_flood_*.geojson`)

**Source:** `https://data-melbournewater.opendata.arcgis.com/`
**Acquired:** Downloaded individual GeoJSON files per catchment. Each catchment has two files: `_current` (present-day 1% AEP) and `_2100` (projected 2100 extent).

### `VIC/flood/vic_flood_history_oct2022.geojson`

**Source:** `https://discover.data.vic.gov.au/dataset/victorian-flood-history-october-2022-event-public`
**1,826 features.** Direct download.

### `VIC/flood/vic_flood_stat_100yr.geojson`

**Source:** `https://discover.data.vic.gov.au/dataset/1-in-100-year-flood-extent`
**Direct download.**

### `VIC/flood/vicmap_planning_FO.geojson` and `vicmap_planning_LSIO.geojson`

**Source:** `https://discover.data.vic.gov.au/dataset/vicmap-planning`
Floodway Overlay (FO) and Land Subject to Inundation Overlay (LSIO) polygons. Direct download.

---

## Scripts

Helper scripts used during acquisition and configuration are stored in `scripts/`:

| Script | Purpose |
|--------|---------|
| `scripts/build.js` | Main build script — copies source files to `www/` |
| `scripts/add_metadata.py` | One-off script used to add `metadata` blocks to all new GeoJSON files in the fire/SES session |
| `scripts/update_layers.py` | One-off script used to add new layer sections to `config/layers.json` |
| `scripts/audit_layers.py` | Compares files on disk against LAYERS.md to find undocumented or missing files |

`audit_layers.py` is worth running any time new files are added:

```bash
python scripts/audit_layers.py
```
