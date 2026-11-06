"""
ml/validate_objects.py  --  checks that objects.geojson follows our contract

WHY WE NEED THIS
----------------
The terrain pipeline and the Unity project both assume objects.geojson has an
exact shape (README Section 5.1). If your model's output differs even a little
(wrong class name, missing field, building stored as a point...), their code
breaks in confusing ways. This script catches those mistakes on YOUR side first.

Run it every time you change how the output is produced:
    python -m ml.validate_objects outputs/test1/objects.geojson
Exit code is 1 if there are problems, 0 if everything is fine.
"""
import json
import sys

# Allowed values, copied from the contract. If the contract changes in the
# README, change these too.
CLASSES = {"building", "tree", "vegetation", "road", "other"}
# Geometry type each class must use (e.g. a building is an outline = Polygon).
GEOM = {"building": "Polygon", "tree": "Point", "vegetation": "Polygon", "road": "LineString"}
SOURCES = {"ml", "dummy", "none"}  # where the height came from

fc = json.load(open(sys.argv[1]))
errors, ids = [], set()
assert fc.get("type") == "FeatureCollection", "Not a FeatureCollection"

for i, f in enumerate(fc["features"]):
    p, g = f.get("properties", {}), f.get("geometry", {})
    tag = f"feature {i} ({p.get('id')})"  # used to point at the bad feature

    # Every object needs a unique ID so it can be tracked across the pipeline.
    if not p.get("id"):
        errors.append(f"{tag}: missing id")
    elif p["id"] in ids:
        errors.append(f"{tag}: duplicate id")
    ids.add(p.get("id"))

    # Class must be one we know how to render in Unity.
    c = p.get("class")
    if c not in CLASSES:
        errors.append(f"{tag}: bad class {c!r}")

    # Geometry type must match the class (roads are lines, trees are points...).
    if c in GEOM and g.get("type") != GEOM[c]:
        errors.append(f"{tag}: {c} should be {GEOM[c]}, got {g.get('type')}")

    if p.get("height_source") not in SOURCES:
        errors.append(f"{tag}: bad height_source")

    # The key must exist even when the height is unknown (value null), so the
    # reader can tell "not estimated" apart from "forgot to include it".
    if "height_above_ground_m" not in p:
        errors.append(f"{tag}: missing height_above_ground_m (use null if unknown)")
    h = p.get("height_above_ground_m")
    if h is not None and (not isinstance(h, (int, float)) or h < 0):
        errors.append(f"{tag}: height must be a number >= 0 or null")

    # Roads are drawn as strips, so Unity needs their width.
    if c == "road" and not p.get("width_m"):
        errors.append(f"{tag}: road needs width_m")

print(f"{len(fc['features'])} features checked.")
if errors:
    print("PROBLEMS:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("OK: matches the contract.")