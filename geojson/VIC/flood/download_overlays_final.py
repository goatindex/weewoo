#!/usr/bin/env python3
"""Download Victorian planning flood overlays (FO, LSIO, SBO) - fixed paths."""

import json, urllib.request, urllib.error, time, os, sys

BASE_URL = "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer"
OUTPUT_DIR = "D:/WeeWoo/geojson/VIC/flood"

LAYERS = [
    {"id": 14, "name": "FO",   "filename": "vicmap_planning_FO.geojson",   "extra": ""},
    {"id": 15, "name": "LSIO", "filename": "vicmap_planning_LSIO.geojson", "extra": ""},
    {"id": 16, "name": "SBO",  "filename": "vicmap_planning_SBO.geojson",  "extra": "&outSR=4326"},
]

RECORD_COUNT = 1000
RETRIES = 5
RETRY_DELAY = 5


def fetch(url):
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"  [attempt {attempt}/{RETRIES}] {e}", flush=True)
            if attempt == RETRIES:
                raise
            time.sleep(RETRY_DELAY)


def download_layer(layer):
    lid, name, filename, extra = layer["id"], layer["name"], layer["filename"], layer["extra"]
    out_path = OUTPUT_DIR + "/" + filename

    # Skip if already complete
    if os.path.exists(out_path):
        size = os.path.getsize(out_path) / 1024 / 1024
        print(f"[SKIP] {name} already exists ({size:.1f} MB)", flush=True)
        return

    print(f"\n=== {name} (layer {lid}) ===", flush=True)
    features, offset, page = [], 0, 1

    while True:
        url = (f"{BASE_URL}/{lid}/query?where=1%3D1&outFields=*"
               f"&f=geojson&resultRecordCount={RECORD_COUNT}&resultOffset={offset}{extra}")
        print(f"  page {page} (offset={offset})...", flush=True)
        data = fetch(url)

        if "error" in data:
            print(f"  [ERROR] {data['error']}", flush=True)
            break

        batch = data.get("features", [])
        features.extend(batch)
        print(f"  got {len(batch)} -> total {len(features)}", flush=True)

        if len(batch) < RECORD_COUNT:
            break
        offset += len(batch)
        page += 1
        time.sleep(0.3)

    if not features:
        print(f"  [ERROR] No features — skipping file write", flush=True)
        return

    print(f"  Writing {out_path} ...", flush=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, separators=(",", ":"))

    size = os.path.getsize(out_path) / 1024 / 1024
    print(f"  Done — {len(features):,} features, {size:.1f} MB", flush=True)


if __name__ == "__main__":
    for layer in LAYERS:
        try:
            download_layer(layer)
        except Exception as e:
            print(f"[FATAL] {layer['name']}: {e}", flush=True)

    print("\n=== All done ===", flush=True)
    powershell_check = os.popen('powershell -Command "Get-ChildItem \'D:\\WeeWoo\\geojson\\VIC\\flood\' -Filter \'vicmap*\' | Select-Object Name, @{N=\'MB\';E={[math]::Round($_.Length/1MB,1)}}"').read()
    print(powershell_check)
