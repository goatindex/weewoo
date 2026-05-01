#!/usr/bin/env python3
"""Download SBO in native VicGrid94, reproject to WGS84 locally with pyproj."""

import json, urllib.request, time, os
from pyproj import Transformer

BASE_URL = "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer"
OUT = "D:/WeeWoo/geojson/VIC/flood/vicmap_planning_SBO.geojson"
LAYER = 16
RECORD_COUNT = 500
RETRIES = 5
TOTAL = 2838

# VicGrid94 (EPSG:3111) -> WGS84 (EPSG:4326)
transformer = Transformer.from_crs("EPSG:3111", "EPSG:4326", always_xy=True)


def fetch(url):
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"  [attempt {attempt}] {e}", flush=True)
            if attempt == RETRIES:
                raise
            time.sleep(5)


def reproject_ring(ring):
    """Reproject a list of [x, y] coords from VicGrid94 to WGS84."""
    xs = [c[0] for c in ring]
    ys = [c[1] for c in ring]
    lons, lats = transformer.transform(xs, ys)
    return [[lon, lat] for lon, lat in zip(lons, lats)]


def esri_to_geojson_geom(esri_geom):
    if esri_geom is None:
        return None
    if "rings" in esri_geom:
        rings = [reproject_ring(r) for r in esri_geom["rings"]]
        if len(rings) == 1:
            return {"type": "Polygon", "coordinates": rings}
        return {"type": "MultiPolygon", "coordinates": [[r] for r in rings]}
    if "x" in esri_geom:
        lon, lat = transformer.transform(esri_geom["x"], esri_geom["y"])
        return {"type": "Point", "coordinates": [lon, lat]}
    return None


print(f"=== SBO (layer {LAYER}) - native CRS + local reproject ===", flush=True)
all_features = []
offset = 0
page = 1

while True:
    # No outSR - fetch in native VicGrid94
    url = (
        f"{BASE_URL}/{LAYER}/query?where=1%3D1&outFields=*"
        f"&f=json&resultRecordCount={RECORD_COUNT}&resultOffset={offset}"
    )
    print(f"  page {page} (offset={offset})...", flush=True)
    data = fetch(url)

    if "error" in data:
        print(f"  [ERROR] {data['error']}", flush=True)
        break

    esri_features = data.get("features", [])
    for ef in esri_features:
        geom = esri_to_geojson_geom(ef.get("geometry"))
        props = ef.get("attributes", {})
        all_features.append({"type": "Feature", "geometry": geom, "properties": props})

    count = len(esri_features)
    pct = round(len(all_features) / TOTAL * 100)
    print(f"  got {count} -> total {len(all_features)} ({pct}%)", flush=True)

    if count < RECORD_COUNT:
        break
    offset += count
    page += 1
    time.sleep(0.3)

if not all_features:
    print("[ERROR] No features downloaded.", flush=True)
else:
    print(f"Writing {OUT} ...", flush=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": all_features}, f, separators=(",", ":"))
    size = os.path.getsize(OUT) / 1024 / 1024
    print(f"Done - {len(all_features):,} features, {size:.1f} MB", flush=True)
