#!/usr/bin/env python3
"""Download FO and SBO flood overlay layers (retry after initial failures)."""

import json
import urllib.request
import urllib.error
import time

BASE_URL = "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer"
OUTPUT_DIR = "/d/WeeWoo/geojson/VIC/flood"

# Only download layers that need retry
LAYERS = [
    {
        "id": 14,
        "name": "FO",
        "filename": "vicmap_planning_FO.geojson",
        "extra_params": "",
    },
    {
        "id": 16,
        "name": "SBO",
        "filename": "vicmap_planning_SBO.geojson",
        # Force WGS84 reprojection - VicGrid94 (102171) may cause GeoJSON 500
        "extra_params": "&outSR=4326",
    },
]

RECORD_COUNT = 1000
RETRY_ATTEMPTS = 5
RETRY_DELAY = 5  # seconds


def fetch_url(url, attempt=1):
    """Fetch a URL and return parsed JSON, with retries."""
    print(f"  GET {url[:130]}...")
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


def download_layer(layer_id, layer_name, filename, extra_params=""):
    """Download all features for a layer using pagination."""
    print(f"\n=== Downloading layer {layer_id}: {layer_name} ===")
    all_features = []
    last_crs = None
    offset = 0
    page = 1
    had_error = False

    while True:
        url = (
            f"{BASE_URL}/{layer_id}/query"
            f"?where=1%3D1"
            f"&outFields=*"
            f"&f=geojson"
            f"&resultRecordCount={RECORD_COUNT}"
            f"&resultOffset={offset}"
            f"{extra_params}"
        )

        print(f"  Page {page} (offset={offset})...")
        try:
            data = fetch_url(url)
        except Exception as e:
            print(f"  [ERROR] Failed to fetch page {page}: {e}")
            had_error = True
            break

        # Handle error responses from server
        if "error" in data:
            print(f"  [ERROR] Server returned error: {data['error']}")
            had_error = True
            break

        features = data.get("features", [])
        count = len(features)
        running_total = len(all_features) + count
        print(f"  Got {count} features (total so far: {running_total})")

        # Track CRS from response
        if "crs" in data:
            last_crs = data["crs"]

        all_features.extend(features)

        # If fewer records than requested, we've reached the end
        if count < RECORD_COUNT:
            print(f"  Reached end of data (last page had {count} < {RECORD_COUNT} records)")
            break

        offset += count
        page += 1
        # Small delay to be polite to the server
        time.sleep(0.5)

    total = len(all_features)
    print(f"  Total features downloaded: {total}")

    if total == 0:
        print(f"  [SKIP] No features, not writing file.")
        return 0, 0

    # Build merged FeatureCollection
    feature_collection = {
        "type": "FeatureCollection",
        "features": all_features
    }
    if last_crs:
        feature_collection["crs"] = last_crs

    # Use forward-slash path explicitly to avoid Windows backslash issues
    out_path = OUTPUT_DIR + "/" + filename
    print(f"  Writing to {out_path}...")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(feature_collection, f, separators=(",", ":"))

    import os
    size_bytes = os.path.getsize(out_path)
    size_mb = size_bytes / (1024 * 1024)
    print(f"  Saved: {size_mb:.2f} MB ({size_bytes:,} bytes)")
    return total, size_bytes


def main():
    results = []
    errors = []

    for layer in LAYERS:
        try:
            count, size = download_layer(
                layer["id"], layer["name"], layer["filename"], layer.get("extra_params", "")
            )
            if count > 0:
                results.append({
                    "name": layer["name"],
                    "id": layer["id"],
                    "features": count,
                    "size_bytes": size,
                    "size_mb": size / (1024 * 1024),
                })
            else:
                errors.append({"name": layer["name"], "id": layer["id"], "error": "0 features downloaded"})
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


if __name__ == "__main__":
    main()
