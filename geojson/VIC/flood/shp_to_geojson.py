#!/usr/bin/env python3
"""Convert a Shapefile to GeoJSON using pyshp + shapely."""

import json, shapefile, sys
from shapely.geometry import shape, mapping

SHP = "D:/WeeWoo/geojson/VIC/flood/vic_flood_stat_100yr_extracted/VIC_DEPI_100_Year_Flood_Extent/ll_gda94/extent_100y_ari.shp"
OUT = "D:/WeeWoo/geojson/VIC/flood/vic_flood_stat_100yr.geojson"

print(f"Reading {SHP} ...")
sf = shapefile.Reader(SHP)
fields = [f[0] for f in sf.fields[1:]]  # skip DeletionFlag
features = []
total = len(sf)
for i, sr in enumerate(sf.iterShapeRecords()):
    if i % 500 == 0:
        print(f"  {i}/{total} features processed...", flush=True)
    geom = sr.shape.__geo_interface__
    props = dict(zip(fields, sr.record))
    features.append({"type": "Feature", "geometry": geom, "properties": props})

fc = {"type": "FeatureCollection", "features": features}
print(f"Writing {OUT} ...")
with open(OUT, "w") as f:
    json.dump(fc, f, separators=(",", ":"))

import os
size = os.path.getsize(OUT) / 1024 / 1024
print(f"Done — {len(features)} features, {size:.1f} MB")
