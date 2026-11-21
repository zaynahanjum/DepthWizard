
import rasterio


def inspect_raster(file_path):

    print("\n" + "=" * 50)
    print("FILE:", file_path)
    print("=" * 50)

    with rasterio.open(file_path) as dataset:

        print("CRS:", dataset.crs)
        print("Width:", dataset.width)
        print("Height:", dataset.height)

        print("Number of bands:", dataset.count)
        print("Data type:", dataset.dtypes)

        print("Bounds:", dataset.bounds)
        print("Transform:", dataset.transform)

        print("Resolution:", dataset.res)
        print("NoData value:", dataset.nodata)

        print("Band descriptions:", dataset.descriptions)
        print("Band units:", dataset.units)

        print("Coordinate system projected:",
              dataset.crs.is_projected if dataset.crs else None)

        # Read first band
        data = dataset.read(1)

        print("\nFirst band information:")
        print("Array shape:", data.shape)

        valid = dataset.read_masks(1) > 0

        if valid.any():
            print("Minimum:", data[valid].min())
            print("Maximum:", data[valid].max())
        else:
            print("No valid pixels found.")


if __name__ == "__main__":

    inspect_raster("data/samples/satellite.tif")

    inspect_raster("data/samples/original_dtm.tif")

# import rasterio
# print("INSPECT.PY IS RUNNING!")
# IMAGE_PATH = "data/samples/satellite.tif"

# with rasterio.open(IMAGE_PATH) as dataset:
#     print("\n========== SATELLITE IMAGE DETAILS ==========")

#     print("CRS:", dataset.crs)
#     print("Bounds:", dataset.bounds)
#     print("Width:", dataset.width)
#     print("Height:", dataset.height)
#     print("Resolution:", dataset.res)
#     print("Transform:", dataset.transform)

#     print("=============================================")
