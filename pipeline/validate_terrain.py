
import rasterio
import numpy as np

SATELLITE_PATH = "data/samples/satellite.tif"
TERRAIN_PATH = "outputs/terrain_dem.tif"

print("\n========== TERRAIN VALIDATION ==========\n")

with rasterio.open(SATELLITE_PATH) as sat, \
     rasterio.open(TERRAIN_PATH) as terrain:

    # 1. Compare coordinate reference systems
    print("1. CRS CHECK")
    print("Satellite:", sat.crs)
    print("Terrain:  ", terrain.crs)
    print("Match:", sat.crs == terrain.crs)

    # 2. Compare raster dimensions
    print("\n2. DIMENSION CHECK")
    print("Satellite:", sat.width, "x", sat.height)
    print("Terrain:  ", terrain.width, "x", terrain.height)
    print("Match:", sat.width == terrain.width
          and sat.height == terrain.height)

    # 3. Compare pixel alignment
    print("\n3. TRANSFORM CHECK")
    print("Satellite:", sat.transform)
    print("Terrain:  ", terrain.transform)
    print("Match:", sat.transform == terrain.transform)

    # 4. Compare geographic bounds
    print("\n4. BOUNDS CHECK")
    print("Satellite:", sat.bounds)
    print("Terrain:  ", terrain.bounds)
    print("Match:", sat.bounds == terrain.bounds)

    # 5. Compare pixel resolution
    print("\n5. RESOLUTION CHECK")
    print("Satellite:", sat.res)
    print("Terrain:  ", terrain.res)
    print("Match:", np.allclose(sat.res, terrain.res))

    # 6. Check valid terrain values
    print("\n6. ELEVATION DATA CHECK")
    elevation = terrain.read(1, masked=True)
    valid = elevation.compressed()

    print("Total pixels:", elevation.size)
    print("Valid pixels:", valid.size)
    print("NoData pixels:", elevation.size - valid.size)

    if valid.size:
        print("Minimum:", valid.min())
        print("Maximum:", valid.max())
        print("Mean:", valid.mean())

print("\n========== VALIDATION COMPLETE ==========")
