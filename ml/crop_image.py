"""
ml/crop_image.py  --  cut a small area out of a large GeoTIFF

WHY WE NEED THIS
----------------
Satellite downloads are often huge (e.g. 10980 x 10980 pixels, ~110 km wide).
Models cannot process an image that big at once, and our 3D scene only needs a
small area (a few hundred metres to a few km). So we cut out the part we want.

The crop KEEPS its georeferencing: the new file still knows exactly where on
Earth it is. That is essential, because later we align it with the DEM and turn
pixel positions into lon/lat. (Cropping with a normal image editor would lose
this information.)

TWO WAYS TO CHOOSE THE AREA
---------------------------
1) By pixels:   --pixels COL ROW WIDTH HEIGHT
     COL/ROW = top-left corner of the crop in pixels, WIDTH/HEIGHT = its size.
2) By location: --center LON LAT --size-m SIZE
     A square of SIZE metres per side, centred on a lon/lat point.
     (Metres are converted to pixels using the image's pixel size.)

EXAMPLES (run from the project root)
-------------------------------------
    python -m ml.crop_image --input data/samples/sample_image.tif \
        --output data/samples/crop.tif --pixels 5000 5000 512 512

    python -m ml.crop_image --input data/samples/sample_image.tif \
        --output data/samples/crop.tif --center 74.93 12.87 2000

NOTE: cropping does not add detail. If one pixel is 10 m, the crop still has
10 m pixels. It only makes the image small enough to work with.
"""
import argparse
import os

import rasterio
from rasterio.warp import transform
from rasterio.windows import Window


def window_from_pixels(col, row, width, height):
    """A window is rasterio's name for 'a rectangle of pixels'."""
    return Window(col, row, width, height)


def window_from_center(src, lon, lat, size_m):
    """
    Build a square window of size_m metres centred on a lon/lat point.

    Steps:
      1. lon/lat -> image coordinate system (the image may be in UTM metres)
      2. coordinate -> pixel (row, col) using the image's geotransform
      3. metres -> pixels using the pixel size
    """
    if src.crs is None:
        raise SystemExit("ERROR: image has no CRS, so --center cannot be used. Use --pixels.")

    xs, ys = transform("EPSG:4326", src.crs, [lon], [lat])   # step 1
    row, col = src.index(xs[0], ys[0])                        # step 2

    # Step 3: pixel size is in CRS units. For metre-based CRS (like UTM) this
    # is metres per pixel. Geographic CRS (degrees) is not supported here.
    if src.crs.is_geographic:
        raise SystemExit("ERROR: image CRS is in degrees; use --pixels instead.")
    px_w, px_h = abs(src.res[0]), abs(src.res[1])
    half_w = int(round(size_m / px_w / 2))
    half_h = int(round(size_m / px_h / 2))
    return Window(col - half_w, row - half_h, 2 * half_w, 2 * half_h)


def crop(input_path, output_path, pixels=None, center=None, size_m=None):
    with rasterio.open(input_path) as src:
        if pixels is not None:
            window = window_from_pixels(*pixels)
        else:
            window = window_from_center(src, center[0], center[1], size_m)

        # Clip the window to the image so we never read outside it.
        full = Window(0, 0, src.width, src.height)
        window = window.intersection(full) if _overlaps(window, full) else None
        if window is None:
            raise SystemExit("ERROR: the chosen area is outside the image.")
        window = window.round_offsets().round_lengths()
        if window.width < 1 or window.height < 1:
            raise SystemExit("ERROR: the crop would be empty.")

        # Only RGB is needed by our models. If there are more bands (e.g. alpha
        # or infrared), keep just the first three.
        bands = [1, 2, 3] if src.count >= 3 else list(range(1, src.count + 1))

        # Reading ONLY the window means we never load the whole huge image.
        data = src.read(bands, window=window)

        # The crop's geotransform is the original one shifted to the window's
        # corner. This is what keeps the georeferencing correct.
        profile = src.profile.copy()
        profile.update(
            width=int(window.width),
            height=int(window.height),
            count=len(bands),
            transform=src.window_transform(window),
        )

        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with rasterio.open(output_path, "w", **profile) as dst:
            dst.write(data)

    print(f"Saved {output_path}: {int(window.width)} x {int(window.height)} px, "
          f"{len(bands)} bands, pixel size {abs(src.res[0])} (CRS units)")


def _overlaps(a, b):
    """True if two windows share at least some pixels."""
    return not (a.col_off >= b.col_off + b.width or a.col_off + a.width <= b.col_off or
                a.row_off >= b.row_off + b.height or a.row_off + a.height <= b.row_off)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Crop a GeoTIFF, keeping its georeferencing.")
    ap.add_argument("--input", required=True, help="big GeoTIFF")
    ap.add_argument("--output", required=True, help="where to save the cropped GeoTIFF")
    ap.add_argument("--pixels", nargs=4, type=int, metavar=("COL", "ROW", "WIDTH", "HEIGHT"),
                    help="crop by pixel rectangle")
    ap.add_argument("--center", nargs=2, type=float, metavar=("LON", "LAT"),
                    help="centre of the crop in lon/lat (use with --size-m)")
    ap.add_argument("--size-m", type=float, help="side of the square crop in metres")
    args = ap.parse_args()

    if args.pixels and args.center:
        ap.error("choose ONE of --pixels or --center")
    if args.center and not args.size_m:
        ap.error("--center needs --size-m")
    if not args.pixels and not args.center:
        ap.error("give either --pixels or --center with --size-m")

    crop(args.input, args.output, pixels=args.pixels, center=args.center, size_m=args.size_m)