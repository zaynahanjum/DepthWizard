"""
ml/check_geotiff.py  --  quick health check for a test image

WHY WE NEED THIS
----------------
Our whole project depends on the image being GEOREFERENCED: it must know where
on Earth it is (a CRS and bounds). Only then can we line it up with the DEM and
turn pixel positions into real coordinates. A plain PNG/JPG, or a TIFF without
location info, will not work.

Run this first on any new test image:
    python -m ml.check_geotiff data/samples/sample_image.tif

What to look at in the output:
  * CRS        : must not be None
  * Pixel size : metres (or degrees) per pixel; smaller = more detail
  * Bands      : we expect 3 (red, green, blue), sometimes 4 (+ alpha/infrared)
"""
import sys
import rasterio

path = sys.argv[1]
with rasterio.open(path) as src:
    print("File       :", path)
    print("Size (px)  :", src.width, "x", src.height)
    print("Bands      :", src.count, src.dtypes)
    print("CRS        :", src.crs)            # coordinate system
    print("Bounds     :", src.bounds)         # the area the image covers
    print("Pixel size :", src.res, "(units of the CRS)")
    if src.crs is None:
        print("\n>>> NOT georeferenced. The pipeline needs a georeferenced image.")
    else:
        print("\nOK: georeferenced.")