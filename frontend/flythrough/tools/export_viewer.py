"""
Convert the pipeline's GeoTIFFs into the files the flythrough viewer reads
(README section 5.3):  heightmap16.png, texture.png, metadata.json

    python frontend/flythrough/tools/export_viewer.py \
        --terrain outputs/terrain_dem.tif \
        --satellite data/samples/satellite.tif \
        --out frontend/flythrough/public/data

then open  http://localhost:5173/?base=./data/

The full-resolution rasters (e.g. 10980 x 10980) are far too big for a browser, so
they are downsampled (GDAL "average", which ignores NoData) to --max-size / --texture-size.
"""
import argparse
import json
import os

import cv2
import numpy as np
import rasterio
from rasterio.enums import Resampling


def out_shape(width, height, longest):
    s = min(1.0, longest / max(width, height))
    return max(2, round(height * s)), max(2, round(width * s))


def fill_nodata(a, mask):
    """Fill masked cells from the nearest valid cell (falls back to the minimum)."""
    if not mask.any():
        return a
    try:
        from scipy.ndimage import distance_transform_edt
        idx = distance_transform_edt(mask, return_distances=False, return_indices=True)
        return a[tuple(idx)]
    except ImportError:
        a = a.copy()
        a[mask] = a[~mask].min()
        return a


def export(terrain_path, satellite_path, out_dir, max_size=1024, texture_size=2048, job_id="local"):
    os.makedirs(out_dir, exist_ok=True)

    with rasterio.open(terrain_path) as ds:
        shape = out_shape(ds.width, ds.height, max_size)
        dem = ds.read(1, out_shape=shape, resampling=Resampling.average, masked=True)
        bounds, crs = ds.bounds, ds.crs
        width_m = bounds.right - bounds.left
        tags = ds.tags()
    mask = np.ma.getmaskarray(dem) | ~np.isfinite(dem.filled(0))
    data = fill_nodata(dem.filled(0).astype("float32"), mask)
    lo, hi = float(data[~mask].min()), float(data[~mask].max())
    if hi - lo < 1e-6:
        hi = lo + 1.0
    hm16 = np.round((np.clip(data, lo, hi) - lo) / (hi - lo) * 65535).astype("uint16")
    cv2.imwrite(os.path.join(out_dir, "heightmap16.png"), hm16)       # OpenCV keeps 16-bit PNGs
    print(f"heightmap16.png  {hm16.shape[1]}x{hm16.shape[0]}  elevation {lo:.1f}..{hi:.1f} m")

    tex_size = None
    if satellite_path:
        with rasterio.open(satellite_path) as ds:
            shape = out_shape(ds.width, ds.height, texture_size)
            bands = [1, 2, 3] if ds.count >= 3 else [1, 1, 1]
            rgb = ds.read(bands, out_shape=(3, *shape), resampling=Resampling.average).astype("float32")
        if rgb.max() > 255:                                           # e.g. 16-bit reflectance: stretch
            p2, p98 = np.percentile(rgb, [2, 98])
            rgb = np.clip((rgb - p2) / max(p98 - p2, 1e-6), 0, 1) ** (1 / 1.2) * 255
        img = np.moveaxis(np.clip(rgb, 0, 255).astype("uint8"), 0, -1)
        cv2.imwrite(os.path.join(out_dir, "texture.png"), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        tex_size = {"width": img.shape[1], "height": img.shape[0]}
        print(f"texture.png      {img.shape[1]}x{img.shape[0]}")

    meta = {
        "job_id": job_id,
        "input_georeferenced": True,
        "crs": str(crs),
        "extent": {"min_x": bounds.left, "min_y": bounds.bottom, "max_x": bounds.right, "max_y": bounds.top},
        "width": int(hm16.shape[1]),
        "height": int(hm16.shape[0]),
        "pixel_size_m": width_m / hm16.shape[1],
        "terrain": {
            "source": tags.get("source", os.path.basename(terrain_path)),
            "resolution_m": None,
            "vertical_reference": "to be recorded",
            "min_elevation_m": lo,
            "max_elevation_m": hi,
        },
        "objects": {"source": "none", "model": None, "count": 0, "classes": [], "height_meaning": "height above local ground, metres"},
        "derived": {"top_elevation": "terrain ground elevation + height_above_ground_m"},
        "evaluation": {"terrain": None, "object_height": None},
    }
    if tex_size:
        meta["texture"] = tex_size   # optional: texture may be larger than the heightmap; viewer maps by UV
    with open(os.path.join(out_dir, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print("metadata.json written to", out_dir)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--terrain", default="outputs/terrain_dem.tif")
    ap.add_argument("--satellite", default="data/samples/satellite.tif")
    ap.add_argument("--out", default="frontend/flythrough/public/data")
    ap.add_argument("--max-size", type=int, default=1024, help="longest side of heightmap16.png")
    ap.add_argument("--texture-size", type=int, default=2048, help="longest side of texture.png")
    ap.add_argument("--job-id", default="local")
    a = ap.parse_args()
    export(a.terrain, a.satellite if os.path.exists(a.satellite) else None, a.out, a.max_size, a.texture_size, a.job_id)
