import json
import os
from pathlib import Path
from dotenv import load_dotenv

import numpy as np
import rasterio
from rasterio.warp import transform
from PIL import Image

from pipeline.fetch_dtm import fetch_dtm
from pipeline.terrain import align_dtm_to_satellite
from ml.predict import predict_objects

# Load environment variables (e.g. OPENTOPOGRAPHY_API_KEY from .env if present)
load_dotenv()


def run_pipeline(image_path: str, output_dir: str) -> dict:
    """
    Runs the DepthWizard processing pipeline for an uploaded satellite image:
    1. Part A: Predict objects from the satellite image (ml.predict).
    2. Part B: Fetch terrain DTM via OpenTopography API (pipeline.fetch_dtm).
    3. Part B: Reproject and align terrain to the satellite image extent (pipeline.terrain).
    4. Export texture.png (RGB 8-bit PNG for Three.js / frontend preview).
    5. Export heightmap16.png (16-bit single-channel grayscale PNG for 3D terrain mesh).
    6. Combine objects and terrain into objects_placed.geojson and objects_scene.json.
    7. Generate and save metadata.json adhering to README Section 5.3.

    Returns the metadata dictionary.
    """
    image_path = Path(image_path).resolve()
    output_dir = Path(output_dir).resolve()

    output_dir.mkdir(parents=True, exist_ok=True)
    intermediate_dir = output_dir / "intermediate"
    intermediate_dir.mkdir(parents=True, exist_ok=True)

    fetched_dtm_path = intermediate_dir / "fetched_dtm.tif"
    terrain_path = output_dir / "terrain_dem.tif"
    texture_path = output_dir / "texture.png"
    heightmap_path = output_dir / "heightmap16.png"
    objects_path = output_dir / "objects.geojson"
    objects_placed_path = output_dir / "objects_placed.geojson"
    objects_scene_path = output_dir / "objects_scene.json"
    metadata_path = output_dir / "metadata.json"

    print("\n========== DEPTHWIZARD PIPELINE START ==========")
    print(f"Input image: {image_path}")
    print(f"Output directory: {output_dir}")

    # -------------------------------------------------------------
    # Step 1: PART A - Object Prediction (ML Stub)
    # -------------------------------------------------------------
    print("\n[Step 1/6] Running object prediction (Part A)...")
    object_info = predict_objects(
        image_path=str(image_path),
        output_path=str(objects_path),
    )

    # -------------------------------------------------------------
    # Step 2: PART B - Fetch DTM from OpenTopography
    # -------------------------------------------------------------
    print("\n[Step 2/6] Fetching DTM from OpenTopography (Part B)...")
    fetch_dtm(
        satellite_path=str(image_path),
        output_path=str(fetched_dtm_path),
    )

    # -------------------------------------------------------------
    # Step 3: PART B - Align Terrain to Satellite Grid
    # -------------------------------------------------------------
    print("\n[Step 3/6] Aligning terrain elevation to satellite grid...")
    align_dtm_to_satellite(
        satellite_path=str(image_path),
        dtm_path=str(fetched_dtm_path),
        output_path=str(terrain_path),
    )

    # -------------------------------------------------------------
    # Step 4: Export texture.png
    # -------------------------------------------------------------
    print("\n[Step 4/6] Exporting texture.png...")
    with rasterio.open(image_path) as sat:
        sat_crs = str(sat.crs)
        sat_transform = sat.transform
        sat_bounds = sat.bounds
        sat_width = int(sat.width)
        sat_height = int(sat.height)
        sat_res = float(abs(sat.res[0]))

        # Read bands 1, 2, 3 as RGB
        r = sat.read(1)
        g = sat.read(2)
        b = sat.read(3)
        rgb = np.stack([r, g, b], axis=-1)

        if rgb.dtype == np.uint8:
            rgb_u8 = rgb
        else:
            # Normalize to 0-255 using 2nd and 98th percentiles for good contrast
            rgb_u8 = np.zeros_like(rgb, dtype=np.uint8)
            for c_idx in range(3):
                channel = rgb[:, :, c_idx]
                valid_channel = channel[np.isfinite(channel)]
                if valid_channel.size > 0:
                    p2, p98 = np.percentile(valid_channel, (2, 98))
                    if p98 > p2:
                        clipped = np.clip((channel - p2) / (p98 - p2) * 255.0, 0, 255)
                        rgb_u8[:, :, c_idx] = clipped.astype(np.uint8)
                    else:
                        rgb_u8[:, :, c_idx] = np.clip(channel, 0, 255).astype(np.uint8)

        Image.fromarray(rgb_u8).save(texture_path, format="PNG")

    # -------------------------------------------------------------
    # Step 5: Export heightmap16.png (16-bit grayscale)
    # -------------------------------------------------------------
    print("\n[Step 5/6] Exporting heightmap16.png (16-bit elevation)...")
    with rasterio.open(terrain_path) as dem_src:
        dem_data = dem_src.read(1)
        nodata = dem_src.nodata if dem_src.nodata is not None else -9999.0
        valid_mask = np.isfinite(dem_data) & (dem_data != nodata)

        if np.any(valid_mask):
            min_elev = float(np.min(dem_data[valid_mask]))
            max_elev = float(np.max(dem_data[valid_mask]))
            mean_elev = float(np.mean(dem_data[valid_mask]))
        else:
            min_elev = 0.0
            max_elev = 1.0
            mean_elev = 0.0

        elev_range = max_elev - min_elev
        if elev_range > 0:
            norm_dem = (dem_data - min_elev) / elev_range
            heightmap_u16 = np.clip(norm_dem * 65535.0, 0, 65535).astype(np.uint16)
        else:
            heightmap_u16 = np.zeros_like(dem_data, dtype=np.uint16)

        heightmap_u16[~valid_mask] = 0
        Image.fromarray(heightmap_u16).save(heightmap_path, format="PNG")

    # -------------------------------------------------------------
    # Step 6: Spatial combination -> objects_placed & objects_scene
    # -------------------------------------------------------------
    print("\n[Step 6/6] Combining objects with terrain elevations...")
    with open(objects_path, "r", encoding="utf-8") as f:
        objects_fc = json.load(f)

    min_x = float(sat_bounds.left)
    min_y = float(sat_bounds.bottom)

    placed_features = []
    scene_objects = []

    for feat in objects_fc.get("features", []):
        props = dict(feat.get("properties", {}))
        geom = feat.get("geometry", {})
        gtype = geom.get("type")
        h_above_ground = props.get("height_above_ground_m")

        if gtype == "Point":
            lon, lat = geom["coordinates"]
            [X], [Y] = transform("EPSG:4326", sat_crs, [lon], [lat])
            r, c = rasterio.transform.rowcol(sat_transform, X, Y)
            if 0 <= r < sat_height and 0 <= c < sat_width and valid_mask[r, c]:
                ground_elev = float(dem_data[r, c])
            else:
                ground_elev = min_elev

            props["ground_elevation_m"] = round(ground_elev, 2)
            if h_above_ground is not None:
                props["top_elevation_m"] = round(ground_elev + float(h_above_ground), 2)
            else:
                props["top_elevation_m"] = None

            scene_item = {
                "id": props.get("id"),
                "class": props.get("class"),
                "position_xz": [round(X - min_x, 2), round(Y - min_y, 2)],
                "base_y": round(max(0.0, ground_elev - min_elev), 2),
                "height_m": h_above_ground,
            }
            if "crown_radius_m" in props:
                scene_item["crown_radius_m"] = props["crown_radius_m"]
            scene_objects.append(scene_item)

        elif gtype == "Polygon":
            rings = geom.get("coordinates", [])
            if rings:
                coords = rings[0]
                lons = [p[0] for p in coords]
                lats = [p[1] for p in coords]
                Xs, Ys = transform("EPSG:4326", sat_crs, lons, lats)

                elev_samples = []
                footprint_xz = []
                for x_val, y_val in zip(Xs, Ys):
                    footprint_xz.append([round(x_val - min_x, 2), round(y_val - min_y, 2)])
                    r, c = rasterio.transform.rowcol(sat_transform, x_val, y_val)
                    if 0 <= r < sat_height and 0 <= c < sat_width and valid_mask[r, c]:
                        elev_samples.append(dem_data[r, c])

                ground_elev = float(np.mean(elev_samples)) if elev_samples else min_elev
                props["ground_elevation_m"] = round(ground_elev, 2)
                if h_above_ground is not None:
                    props["top_elevation_m"] = round(ground_elev + float(h_above_ground), 2)
                else:
                    props["top_elevation_m"] = None

                scene_item = {
                    "id": props.get("id"),
                    "class": props.get("class"),
                    "footprint_xz": footprint_xz,
                    "base_y": round(max(0.0, ground_elev - min_elev), 2),
                    "height_m": h_above_ground,
                }
                scene_objects.append(scene_item)

        elif gtype == "LineString":
            coords = geom.get("coordinates", [])
            lons = [p[0] for p in coords]
            lats = [p[1] for p in coords]
            Xs, Ys = transform("EPSG:4326", sat_crs, lons, lats)
            path_xz = [[round(x_val - min_x, 2), round(y_val - min_y, 2)] for x_val, y_val in zip(Xs, Ys)]
            props["ground_elevation_m"] = round(min_elev, 2)
            props["top_elevation_m"] = round(min_elev, 2)
            scene_item = {
                "id": props.get("id"),
                "class": props.get("class", "road"),
                "path_xz": path_xz,
                "width_m": props.get("width_m", 6.0),
            }
            scene_objects.append(scene_item)

        placed_features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props,
        })

    with open(objects_placed_path, "w", encoding="utf-8") as f:
        json.dump({
            "type": "FeatureCollection",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": placed_features,
        }, f, indent=2)

    with open(objects_scene_path, "w", encoding="utf-8") as f:
        json.dump({
            "origin_crs": sat_crs,
            "origin_sw": [round(min_x, 2), round(min_y, 2)],
            "objects": scene_objects,
        }, f, indent=2)

    # -------------------------------------------------------------
    # Step 7: Build and Save metadata.json
    # -------------------------------------------------------------
    job_id = output_dir.name
    metadata = {
        "job_id": job_id,
        "input_georeferenced": True,
        "crs": sat_crs,
        "extent": {
            "min_x": float(sat_bounds.left),
            "min_y": float(sat_bounds.bottom),
            "max_x": float(sat_bounds.right),
            "max_y": float(sat_bounds.top),
        },
        "width": sat_width,
        "height": sat_height,
        "pixel_size_m": round(sat_res, 4),
        "terrain": {
            "source": "OpenTopography GEDTM30",
            "resolution_m": 30,
            "vertical_reference": "EGM96",
            "min_elevation_m": round(min_elev, 2),
            "max_elevation_m": round(max_elev, 2),
            "mean_elevation_m": round(mean_elev, 2),
        },
        "objects": {
            "source": "dummy" if "STUB" in object_info.get("model", "") else "ml",
            "model": object_info.get("model"),
            "count": object_info.get("object_count", len(placed_features)),
            "classes": object_info.get("classes", []),
            "height_meaning": "height above local ground, metres",
        },
        "derived": {
            "top_elevation": "terrain ground elevation + height_above_ground_m"
        },
        "evaluation": {
            "terrain": None,
            "object_height": None,
        },
        "files": [
            "texture.png",
            "terrain_dem.tif",
            "heightmap16.png",
            "objects.geojson",
            "objects_placed.geojson",
            "objects_scene.json",
            "metadata.json",
        ],
    }

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)

    print("\n========== DEPTHWIZARD PIPELINE COMPLETED ==========")
    return metadata
