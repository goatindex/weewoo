# GeoJSON & Layer Files Index

All files are in GeoJSON format (WGS84 / EPSG:4326) unless noted otherwise.
Source and licence metadata is embedded in each file as a top-level `"metadata"` object in the FeatureCollection.

---

## Victoria — Emergency Services (Boundaries / Polygons)

| File | Description | Geometry | Source | Licence |
|------|-------------|----------|--------|---------|
| [VIC/cfa.geojson](VIC/cfa.geojson) | CFA brigade response area boundaries (1,172 features). Sourced from emapdev.ffm.vic.gov.au MapServer layer 6. | Polygon | [Vicmap Admin — CFA District Polygon](https://discover.data.vic.gov.au/dataset/vicmap-admin-country-fire-authority-cfa-district-polygon) | CC BY 4.0 |
| [VIC/frv.geojson](VIC/frv.geojson) | Fire Rescue Victoria (FRV) boundary polygons | MultiPolygon | [Vicmap Admin — FRV Legislated Boundary Polygon](https://discover.data.vic.gov.au/dataset/vicmap-admin-fire-rescue-victoria-frv-legislated-boundary-polygon) | CC BY 4.0 |
| [VIC/ses.geojson](VIC/ses.geojson) | SES / Emergency Management region boundaries | Polygon | [Vicmap Admin — Emergency Management Region Polygon](https://discover.data.vic.gov.au/dataset/vicmap-admin-emergency-management-region-polygon) | CC BY 4.0 |
| [VIC/ses.with_hq.geojson](VIC/ses.with_hq.geojson) | SES region boundaries + HQ facility coordinates added per feature (HQ_LON / HQ_LAT / HQ_FACILITY_NAME) | Polygon | Derived from VIC/ses.geojson + sesbld.geojson | CC BY 4.0 |

---

## Victoria — Emergency Services (Building Points)

| File | Description | Geometry | Source | Licence |
|------|-------------|----------|--------|---------|
| [VIC/cfabld.geojson](VIC/cfabld.geojson) | CFA building point locations — complete source file (1,291 features, main + satellite). Fields: brig_name, fs_type (main/satellite), street, suburb, pcode, distrct_label | Point | [Vicmap Features of Interest — CFA Fire Station (VMFEAT.GEOMARK_POINT)](https://discover.data.vic.gov.au/dataset/cfa-fire-station-vmfeat-geomark_point) | CC BY 4.0 |
| [VIC/cfa_brigade_bld.geojson](VIC/cfa_brigade_bld.geojson) | CFA brigade main station buildings (1,148 features). Derived from cfabld.geojson: fs_type=main, excludes district HQs, coast guard, and non-brigade industrial operators. Includes Oscar 1 specialist mine rescue unit. | Point | Derived from VIC/cfabld.geojson | CC BY 4.0 |
| [VIC/cfa_district_bld.geojson](VIC/cfa_district_bld.geojson) | CFA district headquarters buildings (18 features). Derived from cfabld.geojson: brig_name contains "Headquarters". | Point | Derived from VIC/cfabld.geojson | CC BY 4.0 |
| [VIC/cfa_coastguard_bld.geojson](VIC/cfa_coastguard_bld.geojson) | CFA-affiliated coast guard station buildings (18 features). Derived from cfabld.geojson: brig_name contains "Coast Guard". | Point | Derived from VIC/cfabld.geojson | CC BY 4.0 |
| [VIC/police.geojson](VIC/police.geojson) | Police station point locations, Victoria | Point | [Digital Atlas of Australia — Police Stations](https://digital.atlas.gov.au/datasets/police-stations/about) | CC BY 4.0 |
| [sesbld.geojson](sesbld.geojson) | SES facility building points, Victoria. Per-feature `facility_source` = data.vic.gov.au | Point | [Digital Atlas of Australia — State Emergency Services Facilities](https://digital.atlas.gov.au/datasets/state-emergency-services-facilities/about) | CC BY 4.0 |

---

## SES Facilities — Split by State (from Digital Atlas national dataset)

Source: [Digital Atlas of Australia — State Emergency Services Facilities](https://digital.atlas.gov.au/datasets/state-emergency-services-facilities/about)
Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
Geometry: Point

| File | State |
|------|-------|
| [VIC/SESBLD_VICTORIA.geojson](VIC/SESBLD_VICTORIA.geojson) | Victoria |
| [NSW/SESBLD_NEW_SOUTH_WALES.geojson](NSW/SESBLD_NEW_SOUTH_WALES.geojson) | New South Wales |
| [QLD/SESBLD_QUEENSLAND.geojson](QLD/SESBLD_QUEENSLAND.geojson) | Queensland |
| [SA/SESBLD_SOUTH_AUSTRALIA.geojson](SA/SESBLD_SOUTH_AUSTRALIA.geojson) | South Australia |
| [WA/SESBLD_WESTERN_AUSTRALIA.geojson](WA/SESBLD_WESTERN_AUSTRALIA.geojson) | Western Australia |
| [TAS/SESBLD_TASMANIA.geojson](TAS/SESBLD_TASMANIA.geojson) | Tasmania |
| [NT/SESBLD_NORTHERN_TERRITORY.geojson](NT/SESBLD_NORTHERN_TERRITORY.geojson) | Northern Territory |
| [ACT/SESBLD_AUSTRALIAN_CAPITAL_TERRITORY.geojson](ACT/SESBLD_AUSTRALIAN_CAPITAL_TERRITORY.geojson) | Australian Capital Territory |

---

## Ambulance Stations — Split by State (from Digital Atlas national dataset)

Source: [Digital Atlas of Australia — Ambulance Stations](https://digital.atlas.gov.au/datasets/ambulance-stations)
Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
Geometry: Point

| File | State / Notes |
|------|---------------|
| [VIC/ambulance_vic.geojson](VIC/ambulance_vic.geojson) | Victoria |
| [NSW/ambulance_nsw.geojson](NSW/ambulance_nsw.geojson) | New South Wales |
| [QLD/ambulance_qld.geojson](QLD/ambulance_qld.geojson) | Queensland |
| [SA/ambulance_sa.geojson](SA/ambulance_sa.geojson) | South Australia |
| [WA/ambulance_wa.geojson](WA/ambulance_wa.geojson) | Western Australia |
| [TAS/ambulance_tas.geojson](TAS/ambulance_tas.geojson) | Tasmania |
| [NT/ambulance_nt.geojson](NT/ambulance_nt.geojson) | Northern Territory |
| [ACT/ambulance_act.geojson](ACT/ambulance_act.geojson) | Australian Capital Territory |
| [VIC/ambulance_backup.geojson](VIC/ambulance_backup.geojson) | Full national dataset (all states). Pre-split backup — use per-state files above in preference. |

---

## Victoria — Administrative Boundaries

| File | Description | Geometry | Source | Licence |
|------|-------------|----------|--------|---------|
| [VIC/LGAs.geojson](VIC/LGAs.geojson) | Local Government Area boundary polygons, Victoria (92 LGAs). Sourced from Geoscape Administrative Boundaries. | MultiPolygon | [Geoscape Administrative Boundaries — VIC LGAs](https://data.gov.au/data/dataset/vic-local-government-areas-geoscape-administrative-boundaries) | CC BY 4.0 |
| [VIC/municipal_offices.geojson](VIC/municipal_offices.geojson) | Municipal office point locations for VIC LGAs (118 features after NSW split). Enriched with `weewoo_role` field. | Point | [Vicmap Features of Interest — FeatureServer Layer 1](https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/arcgis/rest/services/Vicmap_Features_of_Interest/FeatureServer/1) | CC BY 4.0 |
| [NSW/municipal_offices.geojson](NSW/municipal_offices.geojson) | Municipal office point locations for NSW border-region councils (27 features). Split from VIC/municipal_offices.geojson. Enriched with `weewoo_role` field. | Point | [Vicmap Features of Interest — FeatureServer Layer 1](https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/arcgis/rest/services/Vicmap_Features_of_Interest/FeatureServer/1) | CC BY 4.0 |

### `weewoo_role` field

The `weewoo_role` property is added by WeeWoo and is not present in the source data. A value of `"COUNCIL HQ"` indicates that the feature has been identified (via web research) as the primary headquarters building for its Local Government Area. Features without a `"COUNCIL HQ"` value are satellite offices, customer service centres, depots, or unnamed locations. Where a council has only one entry in the dataset that entry is marked `"COUNCIL HQ"` if it corresponds to a plausible council office address. Known data-quality issues are noted below.

**Known data issues in source data:**
- `WURRIKI NYAL` is geocoded to Geelong ([144.357, -38.145]) but belongs to Brimbank (Sunshine); coordinates appear incorrect in the source.
- `WELLINGTON SHIRE COUNCIL` has two near-identical duplicate points at Sale (~5 m apart); only the first is marked `"COUNCIL HQ"`.
- `CIVIC CENTRE` ([145.106, -37.703]) is a near-duplicate of `BANYULE CITY COUNCIL - GREENSBOROUGH SERVICE CENTRE` at the same location.

---

## LGA Boundaries — Split by State (from ABS ASGS 2024)

Source: [ABS Australian Statistical Geography Standard (ASGS) 2024 — Local Government Areas MapServer](https://geo.abs.gov.au/arcgis/rest/services/ASGS2024/LGA/MapServer)
Layer: 1 (LGA_GEN — generalised boundaries)
Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
Attribution: Australian Bureau of Statistics
Geometry: MultiPolygon
Name field: `lga_name_2024`

| File | State | Features |
|------|-------|---------|
| [VIC/LGAs.geojson](VIC/LGAs.geojson) | Victoria | 92 (Geoscape source — see above) |
| [NSW/LGAs.geojson](NSW/LGAs.geojson) | New South Wales | 131 |
| [QLD/LGAs.geojson](QLD/LGAs.geojson) | Queensland | 80 |
| [SA/LGAs.geojson](SA/LGAs.geojson) | South Australia | 73 |
| [TAS/LGAs.geojson](TAS/LGAs.geojson) | Tasmania | 31 |
| [NT/LGAs.geojson](NT/LGAs.geojson) | Northern Territory | 21 |
| [WA/LGAs.geojson](WA/LGAs.geojson) | Western Australia | 139 |
| [ACT/LGAs.geojson](ACT/LGAs.geojson) | Australian Capital Territory | 3 |

Note: VIC uses the higher-resolution Geoscape dataset (see Victoria — Administrative Boundaries above). All other states use the ABS ASGS 2024 generalised layer.

---

## Fire Brigade Boundaries and Station Points — by State

### Queensland — Rural Fire Service (QFD)

Source: [Queensland Fire Department Open Data Portal](https://www.data.qld.gov.au) and [QFES Boundaries MapServer](https://gisext.qfes.qld.gov.au/arcgis/rest/services/Foundation/QFES_Boundaries/MapServer)
Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
Attribution: Queensland Fire Department

| File | Description | Geometry | Features |
|------|-------------|----------|---------|
| [QLD/rfs_brigades.geojson](QLD/rfs_brigades.geojson) | Rural Fire Service brigade response area boundaries. Field `BRIGADE_NAME`. | Polygon | 1,451 |
| [QLD/rfs_stations.geojson](QLD/rfs_stations.geojson) | RFS station point locations. Sourced from CKAN datastore API; coordinates in GDA2020 (treated as WGS84). Field `name`. | Point | 555 |
| [QLD/ses_areas.geojson](QLD/ses_areas.geojson) | QLD SES operational area boundaries (Layer 7 of QFES MapServer). Field `SES_Area`. | Polygon | 21 |

### Northern Territory — Bushfires NT / NTFRS

Source: [NTG Open Data Portal — Bushfire NT Administration Boundaries](https://data.nt.gov.au/dataset/bushfire-nt-administration-boundaries)
Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
Attribution: Northern Territory Police, Fire and Emergency Services
Vintage: June 2021
Notes: All files reprojected from GDA1994 (EPSG:4283) to WGS84.

| File | Description | Geometry | Features |
|------|-------------|----------|---------|
| [NT/volunteer_brigade_areas.geojson](NT/volunteer_brigade_areas.geojson) | Bushfires NT volunteer bushfire brigade areas (rural/outback). Field `GAZ_NAME`. | Polygon | 20 |
| [NT/darwin_volunteer_brigades.geojson](NT/darwin_volunteer_brigades.geojson) | NTFRS Darwin-region volunteer brigade areas. `GAZ_NAME` is null — use `SHORT_NAME`. | Polygon | 5 |
| [NT/emergency_response_areas.geojson](NT/emergency_response_areas.geojson) | NTFRS (career) emergency response areas. Field `GAZ_NAME`. | Polygon | 22 |
| [NT/fire_management_zones.geojson](NT/fire_management_zones.geojson) | Gazetted fire management zones (statewide). Not wired into the sidebar. | Polygon | 5 |
| [NT/fire_protection_zones.geojson](NT/fire_protection_zones.geojson) | Gazetted fire protection zones (higher-risk areas). Not wired into the sidebar. | Polygon | 4 |

### Western Australia — DFES

Source: [data.wa.gov.au — DFES datasets](https://catalogue.data.wa.gov.au/organization/department-of-fire-emergency-services) via SLIP Public Services MapServer
Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
Attribution: Government of Western Australia (Department of Fire and Emergency Services)
Note: WA volunteer Bush Fire Brigades (managed by local shires) are not published as open data.

| File | Description | Geometry | Features |
|------|-------------|----------|---------|
| [WA/frs_districts.geojson](WA/frs_districts.geojson) | DFES Fire and Rescue Services District boundaries (career FRS only). Field `name`. | Polygon | 96 |
| [WA/dfes_stations.geojson](WA/dfes_stations.geojson) | DFES station locations (career and volunteer). Field `displaynam`; `type` contains station type. | Point | 743 |

### Tasmania — Tasmania Fire Service (TFS)

Source: [The LIST — Emergency Management Public MapServer](https://services.thelist.tas.gov.au/arcgis/rest/services/Public/EmergencyManagementPublic/MapServer)
Licence: Creative Commons Attribution 3.0 Australia (CC BY 3.0 AU)
Attribution: State of Tasmania

| File | Description | Geometry | Features |
|------|-------------|----------|---------|
| [TAS/fire_stations.geojson](TAS/fire_stations.geojson) | TFS station locations (career and volunteer). Fields: `BRIGADE`, `TFS_GROUP`, `DISTRICT`, `REGION`, `STATION_TYPE`. | Point | 217 |
| [TAS/ses_offices.geojson](TAS/ses_offices.geojson) | TAS SES office/unit locations. Fields: `SITE_NAME`, `UNIT`, `REGION`. | Point | 37 |

### New South Wales — SES

Source: [NSW SES — SES HQs & Boundaries (Public) FeatureServer](https://services1.arcgis.com/ote4BhoDTJeZCJbh/arcgis/rest/services/SES_HQs_Boundaries/FeatureServer)
Attribution: NSW State Emergency Service
Note: Licence terms not explicitly stated; dataset published as public via NSW SES Map Centre (mapcentre-nswses.hub.arcgis.com).

| File | Description | Geometry | Features |
|------|-------------|----------|---------|
| [NSW/ses_zones.geojson](NSW/ses_zones.geojson) | NSW SES zone boundaries (top level, 7 zones). Field `ZONENAME`. | Polygon | 7 |
| [NSW/ses_clusters.geojson](NSW/ses_clusters.geojson) | NSW SES cluster boundaries (mid level). Field `CLUSTERNAME`. | Polygon | 62 |
| [NSW/ses_units.geojson](NSW/ses_units.geojson) | NSW SES unit boundaries (finest level). Field `UNITNAME`. | Polygon | 234 |
| [NSW/ses_hq.geojson](NSW/ses_hq.geojson) | NSW SES headquarters point locations. Field `HQNAME`; `SES_LEVEL` indicates level. | Point | 261 |

Note: NSW RFS (Rural Fire Service) brigade boundaries are not published as open data — the `gis.fire.nsw.gov.au` ArcGIS service requires authentication. SA CFS (Country Fire Service) brigade boundaries are also not published as open data.

---

## LGA Council Offices — Split by State (from Geoscience Australia national dataset)

Source: [Geoscience Australia — National LGA Council Offices](https://services.ga.gov.au/gis/rest/services/Local_Government_Area_Council_Offices/MapServer/0)
Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
Attribution: Commonwealth of Australia (Geoscience Australia) 2015
Vintage: 2018
Geometry: Point
Name field: `name`

Note: ACT is not present in this dataset. VIC uses the Vicmap-sourced `municipal_offices.geojson` (see above) in preference to this dataset.

| File | State | Features |
|------|-------|---------|
| [NSW/lga_facilities.geojson](NSW/lga_facilities.geojson) | New South Wales | 167 |
| [QLD/lga_facilities.geojson](QLD/lga_facilities.geojson) | Queensland | 94 |
| [SA/lga_facilities.geojson](SA/lga_facilities.geojson) | South Australia | 77 |
| [TAS/lga_facilities.geojson](TAS/lga_facilities.geojson) | Tasmania | 30 |
| [NT/lga_facilities.geojson](NT/lga_facilities.geojson) | Northern Territory | 17 |
| [WA/lga_facilities.geojson](WA/lga_facilities.geojson) | Western Australia | 152 |

---

## Australia — National Boundaries

| File | Description | Geometry | Source | Licence |
|------|-------------|----------|--------|---------|
| [au.json](au.json) | Australia state and territory boundary polygons. Source also referenced per-feature in `properties.source`. | MultiPolygon | [simplemaps.com](https://simplemaps.com) | Free for personal and commercial use |

---

## Victoria — Flood Data

### Melbourne Water — Greater Melbourne Flood Information Program

Source: [Melbourne Water Open Data Hub](https://data-melbournewater.opendata.arcgis.com/)
Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
Geometry: Polygon

Each catchment has two files: `_current` (present-day 1% AEP extent) and `_2100` (projected 2100 extent under climate change).

| File | Catchment |
|------|-----------|
| [VIC/flood/melbwater_flood_darebin_current.geojson](VIC/flood/melbwater_flood_darebin_current.geojson) | Darebin Creek — current |
| [VIC/flood/melbwater_flood_darebin_2100.geojson](VIC/flood/melbwater_flood_darebin_2100.geojson) | Darebin Creek — 2100 projection |
| [VIC/flood/melbwater_flood_glen_eira_current.geojson](VIC/flood/melbwater_flood_glen_eira_current.geojson) | Glen Eira — current |
| [VIC/flood/melbwater_flood_glen_eira_2100.geojson](VIC/flood/melbwater_flood_glen_eira_2100.geojson) | Glen Eira — 2100 projection |
| [VIC/flood/melbwater_flood_merri_bek_current.geojson](VIC/flood/melbwater_flood_merri_bek_current.geojson) | Merri-bek — current |
| [VIC/flood/melbwater_flood_merri_bek_2100.geojson](VIC/flood/melbwater_flood_merri_bek_2100.geojson) | Merri-bek — 2100 projection |
| [VIC/flood/melbwater_flood_yarra_current.geojson](VIC/flood/melbwater_flood_yarra_current.geojson) | Yarra River — current |
| [VIC/flood/melbwater_flood_yarra_2100.geojson](VIC/flood/melbwater_flood_yarra_2100.geojson) | Yarra River — 2100 projection |

### Victoria — Statewide Flood Data

| File | Description | Geometry | Source | Licence |
|------|-------------|----------|--------|---------|
| [VIC/flood/vic_flood_history_oct2022.geojson](VIC/flood/vic_flood_history_oct2022.geojson) | Observed flood inundation extents from the October 2022 Victoria flood event (1,826 features) | MultiPolygon | [data.vic.gov.au — Victorian Flood History October 2022](https://discover.data.vic.gov.au/dataset/victorian-flood-history-october-2022-event-public) | CC BY 4.0 |
| [VIC/flood/vic_flood_stat_100yr.geojson](VIC/flood/vic_flood_stat_100yr.geojson) | Modelled 100-year ARI (1% AEP) flood extents, Victoria. Per-feature `SOURCE` property names the contributing CMA. | Polygon | [data.vic.gov.au — 1 in 100 Year Flood Extent](https://discover.data.vic.gov.au/dataset/1-in-100-year-flood-extent) | CC BY 4.0 |
| [VIC/flood/vicmap_planning_FO.geojson](VIC/flood/vicmap_planning_FO.geojson) | Victorian Planning Scheme Floodway Overlay (FO) polygons, statewide | MultiPolygon | [Vicmap Planning](https://discover.data.vic.gov.au/dataset/vicmap-planning) | CC BY 4.0 |
| [VIC/flood/vicmap_planning_LSIO.geojson](VIC/flood/vicmap_planning_LSIO.geojson) | Victorian Planning Scheme Land Subject to Inundation Overlay (LSIO) polygons, statewide | MultiPolygon | [Vicmap Planning](https://discover.data.vic.gov.au/dataset/vicmap-planning) | CC BY 4.0 |

---

## Notes

### Licences

- **CC BY 4.0** = [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). You must give appropriate credit, provide a link to the licence, and indicate if changes were made.
- **CC BY 3.0 AU** = [Creative Commons Attribution 3.0 Australia](https://creativecommons.org/licenses/by/3.0/au/). Same attribution requirements as CC BY 4.0; applies to Tasmanian LIST datasets.
- **NSW SES data** — no explicit licence is stated on the NSW SES Map Centre. The dataset is published publicly and freely accessible. Treat as attribution required; do not redistribute without checking current terms at [mapcentre-nswses.hub.arcgis.com](https://mapcentre-nswses.hub.arcgis.com).

### Data sources

- **Vicmap** datasets are published by Land Use Victoria (Department of Transport and Planning, Victoria) via [discover.data.vic.gov.au](https://discover.data.vic.gov.au).
- **Digital Atlas of Australia** datasets are published by Geoscience Australia via [digital.atlas.gov.au](https://digital.atlas.gov.au).
- **ABS ASGS** boundary data is published by the Australian Bureau of Statistics via [geo.abs.gov.au](https://geo.abs.gov.au).
- **The LIST** data is published by the Tasmanian Land Information System via [services.thelist.tas.gov.au](https://services.thelist.tas.gov.au).
- **SLIP** (Shared Location Information Platform) data is published by Landgate, Western Australia via [services.slip.wa.gov.au](https://services.slip.wa.gov.au).

### Derived and split files

- Files split by state (SESBLD_*, ambulance_*) originate from the same national Digital Atlas dataset — add attribution to Geoscience Australia / Digital Atlas of Australia when displaying or distributing.
- `VIC/ses.with_hq.geojson` is derived from VIC/ses.geojson; the underlying data remains CC BY 4.0.
- `VIC/cfa_brigade_bld.geojson`, `VIC/cfa_district_bld.geojson`, `VIC/cfa_coastguard_bld.geojson` are derived from `VIC/cfabld.geojson`; the underlying data remains CC BY 4.0.
- `VIC/ambulance_backup.geojson` is the unsplit national ambulance dataset kept as a backup. Use the per-state files for production.
- `NSW/municipal_offices.geojson` is split from VIC/municipal_offices.geojson (border-region NSW councils that appeared in the Vicmap dataset).

### Data not available as open data

- **NSW RFS brigade boundaries** — the NSW Rural Fire Service `gis.fire.nsw.gov.au` ArcGIS server requires authentication. No publicly accessible service found.
- **SA CFS brigade boundaries** — the SA Country Fire Service has not published brigade-level boundary polygons as open data.
- **WA volunteer Bush Fire Brigade boundaries** — approximately 500 brigades managed under ~130 local shires via the Bushfires Act. No central spatial dataset exists; the DFES open data covers career FRS districts only.
