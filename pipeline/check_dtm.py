
import rasterio
import numpy as np

DTM_PATH = "data/samples/original_dtm.tif"

with rasterio.open(DTM_PATH) as dataset:

    print("\n========== DTM VALIDATION ==========")

    print("CRS:", dataset.crs)
    print("Resolution:", dataset.res)
    print("Bounds:", dataset.bounds)
    print("NoData:", dataset.nodata)

    print("Scale:", dataset.scales)
    print("Offset:", dataset.offsets)
    print("Units:", dataset.units)

    print("\nDataset tags:")
    print(dataset.tags())

    print("\nBand tags:")
    print(dataset.tags(1))

    # Ignore NoData pixels
    elevation = dataset.read(1, masked=True)
    valid = elevation.compressed()

    print("\nValid elevation statistics:")
    print("Minimum:", np.min(valid))
    print("Maximum:", np.max(valid))
    print("Mean:", np.mean(valid))

    print("===================================\n")
