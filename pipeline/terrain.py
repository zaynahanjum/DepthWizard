
import os
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling


def align_dtm_to_satellite(
    satellite_path,
    dtm_path,
    output_path,
    resampling=Resampling.bilinear
):
    """
    Reproject and resample a DTM to match a satellite GeoTIFF's grid.

    Parameters
    ----------
    satellite_path : str
        Path to the satellite GeoTIFF.
    dtm_path : str
        Path to the original DTM GeoTIFF.
    output_path : str
        Where the aligned terrain raster will be saved.
    resampling : rasterio.warp.Resampling
        Resampling method. Bilinear is the default for elevation data.

    Returns
    -------
    str
        Path to the generated terrain raster.
    """

    print("\n========== TERRAIN PROCESSING ==========")

    # Open the satellite image to obtain its target grid.
    with rasterio.open(satellite_path) as satellite:

        target_crs = satellite.crs
        target_transform = satellite.transform
        target_width = satellite.width
        target_height = satellite.height

        print("Satellite CRS:", target_crs)
        print("Target dimensions:", target_width, "x", target_height)

        # Open the original DTM.
        with rasterio.open(dtm_path) as dtm:

            print("Original DTM CRS:", dtm.crs)
            print("Original DTM resolution:", dtm.res)

            # Create an output array on the satellite grid.
            destination = np.full(
                (target_height, target_width),
                -9999.0,
                dtype=np.float32
            )

            # Reproject and resample the DTM.
            reproject(
                source=rasterio.band(dtm, 1),
                destination=destination,
                src_transform=dtm.transform,
                src_crs=dtm.crs,
                src_nodata=dtm.nodata,
                dst_transform=target_transform,
                dst_crs=target_crs,
                dst_nodata=-9999.0,
                resampling=resampling
            )

        # Save the aligned terrain raster.
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        profile = {
            "driver": "GTiff",
            "height": target_height,
            "width": target_width,
            "count": 1,
            "dtype": "float32",
            "crs": target_crs,
            "transform": target_transform,
            "nodata": -9999.0,
            "compress": "deflate"
        }

        with rasterio.open(output_path, "w", **profile) as output:
            output.write(destination, 1)

            output.set_band_description(
                1, "Aligned terrain elevation"
            )

            output.update_tags(
                vertical_units="unverified",
                resampling=resampling.name,
                source=os.path.basename(dtm_path)
            )

    # Validate the generated elevation values.
    valid = destination[
        np.isfinite(destination) & (destination != -9999.0)
    ]

    print("\n========== OUTPUT VALIDATION ==========")
    print("Output:", output_path)
    print("Dimensions:", destination.shape)
    print("Valid pixels:", valid.size)
    print("NoData pixels:", destination.size - valid.size)

    if valid.size > 0:
        print("Minimum elevation:", valid.min())
        print("Maximum elevation:", valid.max())
        print("Mean elevation:", valid.mean())
    else:
        raise ValueError(
            "No valid elevation pixels found. "
            "Check the DTM coverage and coordinate systems."
        )

    print("=======================================\n")

    return output_path


# This section runs only when this file is executed directly.
if __name__ == "__main__":

    align_dtm_to_satellite(
        satellite_path="data/samples/satellite.tif",
        dtm_path="data/samples/original_dtm.tif",
        output_path="outputs/terrain_dem.tif"
    )
