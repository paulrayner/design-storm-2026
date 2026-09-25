"""Build the "unwatched reach" polygon for the South Platte above Strontia Springs.

The reach is the part of the Strontia basin (USGS gage 06707525) that drains in
below both upstream flow gages: South Platte below Brush Creek near Trumbull
(06701900) and North Fork of the South Platte at Grant (06702500). No flow gage
sees runoff that starts here, which is why the Aug 14 to 15, 2026 turbidity
spike at Strontia had no matching rise at Trumbull.

Inputs (USGS NLDI basin polygons, fetched once and committed to basins/):
    basins/south-platte-above-strontia-06707525.json
    basins/south-platte-above-trumbull-06701900.json
    basins/north-fork-at-grant-06702500.json

Output:
    basins/unwatched-reach-06707525.json   (GeoJSON FeatureCollection, one feature)

Needs shapely (and pyproj for the equal-area area figure). Offline once the
inputs exist. Run from anywhere:

    python3 strontia-brief/build_unwatched_reach.py
"""

import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform
from shapely.validation import make_valid

BASINS = Path(__file__).resolve().parent / "basins"
STRONTIA = BASINS / "south-platte-above-strontia-06707525.json"
TRUMBULL = BASINS / "south-platte-above-trumbull-06701900.json"
GRANT = BASINS / "north-fork-at-grant-06702500.json"
OUTPUT = BASINS / "unwatched-reach-06707525.json"

# Contiguous US Albers equal-area (EPSG:5070); metres in, so divide by this for mi^2.
EQUAL_AREA_CRS = "EPSG:5070"
SQ_METRES_PER_SQ_MILE = 2_589_988.110336

# NLDI polygons come as WGS84 with ~1e-9 degree vertices; slivers thinner than
# this along shared boundaries are digitising noise, not drainage.
SLIVER_AREA_SQ_MI = 0.05

NOTE = ("Drains to the gage above Strontia Springs below both the Trumbull and "
        "Grant gages: no flow gage sees runoff that starts here.")


def load_basin(path):
    with open(path) as f:
        collection = json.load(f)
    return make_valid(shape(collection["features"][0]["geometry"]))


def area_sq_mi(geom):
    to_equal_area = Transformer.from_crs("EPSG:4326", EQUAL_AREA_CRS, always_xy=True).transform
    return transform(to_equal_area, geom).area / SQ_METRES_PER_SQ_MILE


def drop_slivers(geom):
    parts = getattr(geom, "geoms", [geom])
    kept = [p for p in parts if p.geom_type == "Polygon" and area_sq_mi(p) >= SLIVER_AREA_SQ_MI]
    if len(kept) == 1:
        return kept[0]
    from shapely.geometry import MultiPolygon
    return MultiPolygon(kept)


def build_reach(strontia, trumbull, grant):
    reach = strontia.difference(trumbull).difference(grant)
    return drop_slivers(make_valid(reach))


def feature_collection(geom, area):
    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": mapping(geom),
            "properties": {
                "name": "Unwatched reach",
                "note": NOTE,
                "area_sq_mi": round(area, 1),
            },
            "id": 0,
        }],
    }


def main():
    strontia, trumbull, grant = (load_basin(p) for p in (STRONTIA, TRUMBULL, GRANT))
    reach = build_reach(strontia, trumbull, grant)
    area = area_sq_mi(reach)
    with open(OUTPUT, "w") as f:
        json.dump(feature_collection(reach, area), f, separators=(",", ":"))
    for label, geom in (("Strontia 06707525", strontia), ("Trumbull 06701900", trumbull),
                        ("Grant 06702500", grant), ("Unwatched reach", reach)):
        print(f"{label:20s} {area_sq_mi(geom):9.1f} sq mi  {geom.geom_type}  valid={geom.is_valid}")
    print("reach bounds (minx, miny, maxx, maxy):", tuple(round(b, 3) for b in reach.bounds))
    print("wrote", OUTPUT)


if __name__ == "__main__":
    main()
