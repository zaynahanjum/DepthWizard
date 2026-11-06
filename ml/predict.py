"""
ml/predict.py  --  the ONE entry point of the ML part (owner: Siddu)

WHERE THIS FITS IN THE PROJECT
------------------------------
Our system turns a satellite photo into a 3D world. Two things are needed:
  (A) the ground shape      -> comes from a DEM file (terrain module)
  (B) what stands on it     -> comes from THIS file: buildings, trees, roads,
                               each with an outline and a height

This file is job (B). It takes a georeferenced satellite image and produces a
list of objects, saved as "objects.geojson". The terrain-and-integration
pipeline reads that list, stands each object on the DEM ground, and sends the
result to Unity.

THE CONTRACT (agreed in README Section 5.1)
-------------------------------------------
    predict_objects(image_path, output_path) -> dict
  * Input : georeferenced RGB image (GeoTIFF)
  * Output: objects.geojson in WGS84 lon/lat, one feature per object
  * Heights are "height above ground" in metres (NOT elevation above sea
    level). The pipeline adds the DEM ground height later.
Keep the function name, arguments and output format unchanged, so the other
modules never need to know what changed inside.

*** CURRENT STATUS: STUB ***
This version does NOT use a model. It writes FAKE objects inside the image's
real area so the rest of the team can test their code now. Later, replace the
body of predict_objects() with: run model -> postprocess -> write GeoJSON.

How to run:
    python -m ml.predict --image data/samples/sample_image.tif --output outputs/test1/objects.geojson
"""
import argparse
import json
import os

# Used only if the image can't be read or has no location information.
# Order: (min_lon, min_lat, max_lon, max_lat). Illustrative, near Mangaluru.
FALLBACK_BOUNDS = (74.9290, 12.8685, 74.9330, 12.8720)


def _image_bounds_wgs84(image_path):
    """
    Return the image's area as (min_lon, min_lat, max_lon, max_lat).

    Why: GeoJSON must use lon/lat, but a GeoTIFF is usually in a projected
    system measured in metres (e.g. UTM). We convert so our fake objects land
    inside the image's real area.
    """
    try:
        import rasterio
        from rasterio.warp import transform_bounds
        with rasterio.open(image_path) as src:
            if src.crs is None:
                print("WARNING: image has no CRS (not georeferenced). Using fallback area.")
                return FALLBACK_BOUNDS
            return transform_bounds(src.crs, "EPSG:4326", *src.bounds)
    except Exception as e:  # rasterio missing, file missing, unreadable file...
        print(f"WARNING: could not read image bounds ({e}). Using fallback area.")
        return FALLBACK_BOUNDS


def _pt(b, fx, fy):
    """
    Point at a fractional position inside the bounds box.
    (0,0) = south-west corner, (1,1) = north-east corner.
    Handy for placing fake objects without hardcoding coordinates.
    """
    min_lon, min_lat, max_lon, max_lat = b
    return [min_lon + fx * (max_lon - min_lon), min_lat + fy * (max_lat - min_lat)]


def _box(b, fx, fy, w, h):
    """
    Rectangle polygon (a fake building footprint) at a fractional position.
    A GeoJSON polygon is a list of rings; the first ring is the outline and
    must end at its starting point to be "closed".
    """
    ring = [_pt(b, fx, fy), _pt(b, fx + w, fy), _pt(b, fx + w, fy + h),
            _pt(b, fx, fy + h), _pt(b, fx, fy)]
    return {"type": "Polygon", "coordinates": [ring]}


def _feature(geom, **props):
    """One GeoJSON feature = a shape (geometry) + its attributes (properties)."""
    return {"type": "Feature", "geometry": geom, "properties": props}


def predict_objects(image_path: str, output_path: str) -> dict:
    """
    STUB version: writes fake objects.geojson inside the image's area.

    Returns a small summary dict (count, classes, model name) that the
    pipeline can store in metadata.json.
    """
    b = _image_bounds_wgs84(image_path)

    features = [
        # Two buildings with heights -> normal case.
        _feature(_box(b, 0.20, 0.20, 0.08, 0.08), id="b_0001", **{"class": "building"},
                 height_above_ground_m=12.0, height_source="ml", confidence=0.9),
        _feature(_box(b, 0.45, 0.30, 0.10, 0.06), id="b_0002", **{"class": "building"},
                 height_above_ground_m=20.0, height_source="ml", confidence=0.8),
        # A building whose height is UNKNOWN. Real models will not always know
        # heights, so the pipeline and Unity must cope with null. This tests it.
        _feature(_box(b, 0.65, 0.60, 0.07, 0.07), id="b_0003", **{"class": "building"},
                 height_above_ground_m=None, height_source="none"),
        # Trees are single points with a height and an approximate crown size.
        _feature({"type": "Point", "coordinates": _pt(b, 0.30, 0.65)}, id="t_0001",
                 **{"class": "tree"}, height_above_ground_m=7.5, crown_radius_m=2.0,
                 height_source="ml", confidence=0.7),
        _feature({"type": "Point", "coordinates": _pt(b, 0.75, 0.25)}, id="t_0002",
                 **{"class": "tree"}, height_above_ground_m=9.0, crown_radius_m=2.5,
                 height_source="ml", confidence=0.7),
    ]

    # "stub": true is an extra marker so nobody mistakes this for real output.
    fc = {"type": "FeatureCollection", "stub": True, "features": features}

    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)  # create outputs/<job_id>/ if missing
    with open(output_path, "w") as f:
        json.dump(fc, f, indent=2)

    print("WARNING: ml/predict.py is a STUB. The objects written are FAKE.")
    return {
        "object_count": len(features),
        "classes": sorted({f["properties"]["class"] for f in features}),
        "model": "STUB (fake data)",
    }


if __name__ == "__main__":
    # Lets us run the file from the terminal for quick tests.
    ap = argparse.ArgumentParser(description="Predict objects from a satellite image (STUB).")
    ap.add_argument("--image", required=True, help="georeferenced RGB GeoTIFF")
    ap.add_argument("--output", required=True, help="where to write objects.geojson")
    args = ap.parse_args()
    print(predict_objects(args.image, args.output))