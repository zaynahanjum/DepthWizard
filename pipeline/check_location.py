
import rasterio
from rasterio.warp import transform_bounds

IMAGE_PATH = "data/samples/satellite.tif"

with rasterio.open(IMAGE_PATH) as dataset:

    bounds = transform_bounds(
        dataset.crs,
        "EPSG:4326",
        *dataset.bounds
    )

    west, south, east, north = bounds

    print("\n====== ACTUAL IMAGE LOCATION ======")
    print("West longitude:", west)
    print("South latitude:", south)
    print("East longitude:", east)
    print("North latitude:", north)

    print("===================================")
