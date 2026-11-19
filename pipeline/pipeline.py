"""
pipeline/pipeline.py -- Core pipeline orchestrator for DepthWizard.

Coordinates:
  Path A (ML): Object prediction -> objects.geojson
  Path B (Terrain): DTM reprojection and alignment -> terrain_dem.tif
  Spatial Combination: Transform objects to local scene frame -> objects_scene.json
  Web Exporter: Generates heightmap16.png, texture.png, metadata.json for Three.js
"""
import json
import os
import shutil
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform

from ml.predict import predict_objects
from pipeline.terrain import align_dtm_to_satellite


DEFAULT_OPENTOPOGRAPHY_API_KEY = "ff7885b82b1c3c2f4d6dcff65494b7b4"


def _sample_elevation(dtm_ds, dtm_array, x_coord, y_coord, nodata_val):
    """Sample elevation from DTM array at native coordinates (x, y)."""
    try:
        row, col = dtm_ds.index(x_coord, y_coord)
        if 0 <= row < dtm_array.shape[0] and 0 <= col < dtm_array.shape[1]:
            val = float(dtm_array[row, col])
            if np.isfinite(val) and (nodata_val is None or not np.isclose(val, nodata_val)):
                return val
    except Exception:
        pass
    return None


def convert_objects_to_scene(
    objects_geojson_path: str,
    terrain_dem_path: str,
    output_scene_path: str,
    min_elevation_m: float
) -> int:
    """
    Transforms GeoJSON objects into local coordinate frame in METERS for Three.js:
      - Origin: South-West corner of terrain
      - x: East (meters)
      - z: North (meters)
      - base_y: Elevation in meters relative to min_elevation_m
    """
    if not os.path.exists(objects_geojson_path) or not os.path.exists(terrain_dem_path):
        return 0

    with open(objects_geojson_path, "r", encoding="utf-8") as f:
        fc = json.load(f)

    with rasterio.open(terrain_dem_path) as ds:
        crs = ds.crs
        bounds = ds.bounds
        nodata = ds.nodata
        dtm_data = ds.read(1)
        min_x, min_y = bounds.left, bounds.bottom

    is_geo = crs is not None and crs.is_geographic
    if is_geo:
        mid_lat = np.radians((bounds.top + bounds.bottom) / 2)
        m_lon = 111320.0 * np.cos(mid_lat)
        m_lat = 110540.0
    else:
        m_lon = 1.0
        m_lat = 1.0

    scene_objects = []

    for feature in fc.get("features", []):
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        cls = props.get("class", "building")
        obj_id = props.get("id", "obj")
        height_m = props.get("height_above_ground_m")
        if height_m is None or height_m <= 0:
            height_m = 12.0  # sensible default height for visualization

        coords = geom.get("coordinates", [])

        if cls == "building" and geom.get("type") == "Polygon" and coords:
            ring = coords[0]
            footprint_xz = []
            sampled_elevations = []

            for pt in ring:
                lon, lat = pt[0], pt[1]
                if is_geo or crs is None:
                    px, py = lon, lat
                else:
                    xs, ys = transform("EPSG:4326", crs, [lon], [lat])
                    px, py = xs[0], ys[0]

                lx = float((px - min_x) * m_lon)
                lz = float((py - min_y) * m_lat)
                footprint_xz.append([lx, lz])

                elev = _sample_elevation(ds, dtm_data, px, py, nodata)
                if elev is not None:
                    sampled_elevations.append(elev)

            base_elev = np.median(sampled_elevations) if sampled_elevations else min_elevation_m
            base_y = max(0.0, float(base_elev - min_elevation_m))

            scene_objects.append({
                "id": obj_id,
                "class": "building",
                "footprint_xz": footprint_xz,
                "base_y": base_y,
                "height_m": float(height_m),
            })

        elif cls == "tree" and geom.get("type") == "Point" and coords:
            lon, lat = coords[0], coords[1]
            if is_geo or crs is None:
                px, py = lon, lat
            else:
                xs, ys = transform("EPSG:4326", crs, [lon], [lat])
                px, py = xs[0], ys[0]

            lx = float((px - min_x) * m_lon)
            lz = float((py - min_y) * m_lat)

            elev = _sample_elevation(ds, dtm_data, px, py, nodata)
            base_elev = elev if elev is not None else min_elevation_m
            base_y = max(0.0, float(base_elev - min_elevation_m))

            scene_objects.append({
                "id": obj_id,
                "class": "tree",
                "position_xz": [lx, lz],
                "base_y": base_y,
                "height_m": float(height_m),
                "crown_radius_m": float(props.get("crown_radius_m", 2.5)),
            })

        elif cls == "road" and geom.get("type") == "LineString" and coords:
            path_xz = []
            for pt in coords:
                lon, lat = pt[0], pt[1]
                if is_geo or crs is None:
                    px, py = lon, lat
                else:
                    xs, ys = transform("EPSG:4326", crs, [lon], [lat])
                    px, py = xs[0], ys[0]
                lx = float((px - min_x) * m_lon)
                lz = float((py - min_y) * m_lat)
                path_xz.append([lx, lz])

            scene_objects.append({
                "id": obj_id,
                "class": "road",
                "path_xz": path_xz,
                "width_m": float(props.get("width_m", 6.0)),
            })

    scene_payload = {
        "origin_crs": str(crs),
        "objects": scene_objects
    }

    with open(output_scene_path, "w", encoding="utf-8") as f:
        json.dump(scene_payload, f, indent=2)

    return len(scene_objects)


def run_pipeline(
    image_path: str,
    dem_path: Optional[str] = None,
    output_dir: str = "outputs/default",
    use_dummy_objects: bool = False,
    job_id: str = "local"
) -> dict:
    """
    Executes the end-to-end DepthWizard pipeline.

    1. Path A (ML): predict_objects() -> outputs/<job_id>/objects.geojson
    2. Path B (Terrain): Align DEM to satellite GeoTIFF -> outputs/<job_id>/terrain_dem.tif
    3. Spatial Combination: outputs/<job_id>/objects_scene.json
    4. Viewer Exporter: Downsamples to heightmap16.png, texture.png, metadata.json
    """
    os.makedirs(output_dir, exist_ok=True)
    objects_path = os.path.join(output_dir, "objects.geojson")
    terrain_path = os.path.join(output_dir, "terrain_dem.tif")
    objects_scene_path = os.path.join(output_dir, "objects_scene.json")

    # -------------------------------------------------------------
    # Step 1: Object Prediction (Path A)
    # -------------------------------------------------------------
    ml_summary = predict_objects(image_path, objects_path)

    # -------------------------------------------------------------
    # Step 2: Terrain Processing (Path B)
    # -------------------------------------------------------------
    effective_dem = dem_path

    # If no DEM provided, check OpenTopography or fallback reference
    if not effective_dem or not os.path.exists(effective_dem):
        api_key = os.environ.get("OPENTOPOGRAPHY_API_KEY") or DEFAULT_OPENTOPOGRAPHY_API_KEY
        if api_key:
            os.environ["OPENTOPOGRAPHY_API_KEY"] = api_key
            try:
                from pipeline.fetch_dtm import fetch_dtm
                fetched_path = os.path.join(output_dir, "fetched_dtm.tif")
                effective_dem = fetch_dtm(image_path, fetched_path)
            except Exception as e:
                print(f"[pipeline] OpenTopography fetch failed ({e}). Checking local reference...")

        if not effective_dem or not os.path.exists(effective_dem):
            for candidate in [
                "data/samples/original_dtm.tif",
                "outputs/terrain_dem.tif",
                "data/reference/dem.tif"
            ]:
                if os.path.exists(candidate):
                    effective_dem = candidate
                    break

    if effective_dem and os.path.exists(effective_dem):
        align_dtm_to_satellite(
            satellite_path=image_path,
            dtm_path=effective_dem,
            output_path=terrain_path
        )
    else:
        # Generate synthetic aligned DTM if no reference DEM exists
        print("[pipeline] Warning: No reference DTM available. Creating smooth elevation surface from image grid.")
        with rasterio.open(image_path) as sat:
            h, w = sat.height, sat.width
            crs = sat.crs
            transform_mat = sat.transform
            y_coords, x_coords = np.mgrid[0:h, 0:w]
            synthetic_elev = 150.0 + 30.0 * np.sin(x_coords / (w * 0.1)) + 20.0 * np.cos(y_coords / (h * 0.1))
            synthetic_elev = synthetic_elev.astype(np.float32)

            profile = {
                "driver": "GTiff",
                "height": h,
                "width": w,
                "count": 1,
                "dtype": "float32",
                "crs": crs,
                "transform": transform_mat,
                "nodata": -9999.0,
                "compress": "deflate"
            }
            with rasterio.open(terrain_path, "w", **profile) as out:
                out.write(synthetic_elev, 1)

    # -------------------------------------------------------------
    # Step 3: Export 3D Web Viewer Assets
    # -------------------------------------------------------------
    from frontend.flythrough.tools.export_viewer import export as export_viewer_data
    export_viewer_data(
        terrain_path=terrain_path,
        satellite_path=image_path,
        out_dir=output_dir,
        max_size=1024,
        texture_size=2048,
        job_id=job_id
    )

    # Read generated metadata
    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    min_elevation = metadata.get("terrain", {}).get("min_elevation_m", 0.0)

    # -------------------------------------------------------------
    # Step 4: Spatial Combination -> objects_scene.json
    # -------------------------------------------------------------
    obj_count = convert_objects_to_scene(
        objects_geojson_path=objects_path,
        terrain_dem_path=terrain_path,
        output_scene_path=objects_scene_path,
        min_elevation_m=min_elevation
    )

    # Update metadata with object details
    metadata["objects"] = {
        "source": ml_summary.get("model", "ml"),
        "count": obj_count,
        "classes": ml_summary.get("classes", ["building", "tree"]),
        "height_meaning": "height above local ground, metres"
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return metadata

