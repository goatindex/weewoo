#!/usr/bin/env python3
"""Download Victorian planning flood overlays from ArcGIS REST API."""

import json
import urllib.request
import urllib.error
import time
import os
import sys

BASE_URL = "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer"
OUTPUT_DIR = "D:/WeeWoo/geojson/VIC/flood"

LAYERS = [
    {"id": 14, "name": "FO",   "filename": "vicmap_planning_FO.geojson"},
    {"id": 15, "name": "LSIO", "filename": "vicmap_planning_LSIO.geojson"},
    {"id": 16, "name": "SBO",  "filename": "vicmap_planning_SBO.geojson"},
]

RECORD_COUNT = 1000
RETRY_ATTEMPTS = 5
RETRY_DELAY = 5  # seconds


def fetch_url(url, attempt=1):
    """Fetch a URL and return parsed JSON, with retries."""
    print(f"  GET {url[:120]}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            return json.loads(raw)
    except (urllib.error.URLError, urllib.error.HTTPError, Exception) as e:
        if attempt < RETRY_ATTEMPTS:
            print(f"  [WARN] Attempt {attempt} failed: {e}. Retrying in {RETRY_DELAY}s...")
            time.sleep(RETRY_DELAY)
            return fetch_url(url, attempt + 1)
        else:
            print(f"  [ERROR] All {RETRY_ATTEMPTS} attempts failed for URL: {url}")
            raise


def download_layer(layer_id, layer_name, filename):
    """Download all features for a layer using pagination."""
    print(f"\n=== Downloading layer {layer_id}: {layer_name} ===")
    all_features = []
    offset = 0
    page = 1

    while True:
        url = (
            f"{BASE_URL}/{layer_id}/query"
            f"?where=1%3D1"
            f"&outFields=*"
            f"&f=geojson"
            f"&resultRecordCount={RECORD_COUNT}"
            f"&resultOffset={offset}"
        )

        print(f"  Page {page} (offset={offset})...")
        try:
            data = fetch_url(url)
        except Exception as e:
            print(f"  [ERROR] Failed to fetch page {page}: {e}")
            break

        # Handle error responses from server
        if "error" in data:
            print(f"  [ERROR] Server returned error: {data['error']}")
            break

        features = data.get("features", [])
        count = len(features)
        print(f"  Got {count} features (total so far: {len(all_features) + count})")

        all_features.extend(features)

        # If fewer records than requested, we've reached the end
        if count < RECORD_COUNT:
            print(f"  Reached end of data (last page had {count} < {RECORD_COUNT} records)")
            break

        offset += count
        page += 1
        # Small delay to be polite to the server
        time.sleep(0.5)

    print(f"  Total features downloaded: {len(all_features)}")

    # Build merged FeatureCollection
    # Extract CRS from last response if present
    crs = data.get("crs", None)

    feature_collection = {
        "type": "FeatureCollection",
        "features": all_features
    }
    if crs:
        feature_collection["crs"] = crs

    # Write to file
    out_path = os.path.join(OUTPUT_DIR, filename)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(feature_collection, f, separators=(",", ":"))

    size_bytes = os.path.getsize(out_path)
    size_mb = size_bytes / (1024 * 1024)
    print(f"  Saved to {out_path} ({size_mb:.2f} MB, {size_bytes:,} bytes)")
    return len(all_features), size_bytes


def main():
    results = []
    errors = []

    for layer in LAYERS:
        try:
            count, size = download_layer(layer["id"], layer["name"], layer["filename"])
            results.append({
                "name": layer["name"],
                "id": layer["id"],
                "features": count,
                "size_bytes": size,
                "size_mb": size / (1024 * 1024),
            })
        except Exception as e:
            print(f"  [FATAL ERROR] Layer {layer['name']} (ID {layer['id']}): {e}")
            errors.append({"name": layer["name"], "id": layer["id"], "error": str(e)})

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for r in results:
        print(f"  {r['name']:6s} (layer {r['id']:2d}): {r['features']:6,} features | {r['size_mb']:.2f} MB")

    if errors:
        print("\nERRORS:")
        for e in errors:
            print(f"  {e['name']} (layer {e['id']}): {e['error']}")
    else:
        print("\nNo errors.")

    # Write summary as JSON for easy parsing
    summary = {"results": results, "errors": errors}
    summary_path = os.path.join(OUTPUT_DIR, "download_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nSummary written to {summary_path}")


if __name__ == "__main__":
    main()
