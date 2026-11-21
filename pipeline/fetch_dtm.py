from pipeline.terrain import align_dtm_to_satellite
import os
from pathlib import Path

import requests
import rasterio
from rasterio.warp import transform_bounds


API_URL = "https://portal.opentopography.org/API/globaldem"

SATELLITE_PATH = "data/samples/satellite.tif"
OUTPUT_PATH = "data/downloads/fetched_dtm.tif"
ALIGNED_OUTPUT_PATH = "outputs/terrain_dem.tif"
DATASET = "GEDTM30"
DEFAULT_API_KEY = "ff7885b82b1c3c2f4d6dcff65494b7b4"


def fetch_dtm(satellite_path, output_path, dataset=DATASET):

    api_key = os.environ.get("OPENTOPOGRAPHY_API_KEY") or DEFAULT_API_KEY

    if not api_key:
        raise RuntimeError(
            "OpenTopography API key not found. "
            "Set OPENTOPOGRAPHY_API_KEY in your environment."
        )

    print("\n========== AUTOMATIC DTM FETCHING ==========")

    # 1. Read the satellite image's geographic coverage.
    with rasterio.open(satellite_path) as satellite:

        if satellite.crs is None:
            raise ValueError("Satellite image has no CRS.")

        west, south, east, north = transform_bounds(
            satellite.crs,
            "EPSG:4326",
            *satellite.bounds,
            densify_pts=21
        )

    print("\nSatellite geographic bounds:")
    print("West:", west)
    print("South:", south)
    print("East:", east)
    print("North:", north)

    # 2. Prepare the OpenTopography API request.
    params = {
        "demtype": dataset,
        "south": south,
        "north": north,
        "west": west,
        "east": east,
        "outputFormat": "GTiff",
        "API_Key": api_key
    }

    print("\nRequesting dataset:", dataset)
    print("Contacting OpenTopography...")

    # 3. Request the terrain data.
    response = requests.get(
        API_URL,
        params=params,
        stream=True,
        timeout=(30, 600)
    )

    try:
        response.raise_for_status()

        # 4. Save to a temporary file first.
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        temporary_path = output.with_suffix(
            output.suffix + ".part"
        )

        try:
            with open(temporary_path, "wb") as file:
                for chunk in response.iter_content(
                    chunk_size=1024 * 1024
                ):
                    if chunk:
                        file.write(chunk)

            # 5. Check that the response is a readable GeoTIFF.
            try:
                with rasterio.open(temporary_path) as dtm:
                    print("\nDownloaded DTM information:")
                    print("CRS:", dtm.crs)
                    print("Dimensions:", dtm.width, "x", dtm.height)
                    print("Resolution:", dtm.res)
                    print("Bounds:", dtm.bounds)
                    print("NoData:", dtm.nodata)

                    if dtm.count < 1:
                        raise ValueError("Downloaded raster has no bands.")

            except Exception as error:
                raise RuntimeError(
                    "The API response was not a valid readable raster. "
                    "Check the API response, dataset availability, "
                    "and API key."
                ) from error

            # Move the verified file into its final location.
            os.replace(temporary_path, output)

        finally:
            if temporary_path.exists():
                temporary_path.unlink()

    finally:
        response.close()

    print("\nDTM successfully downloaded!")
    print("Saved to:", output)

    print("\n============================================\n")

    return str(output)


if __name__ == "__main__":

    # Step 1: Download the original DTM.
    fetched_dtm_path = fetch_dtm(
        satellite_path=SATELLITE_PATH,
        output_path=OUTPUT_PATH
    )

    # Step 2: Align the downloaded DTM to the satellite image.
    print("\nStarting terrain alignment...")

    align_dtm_to_satellite(
        satellite_path=SATELLITE_PATH,
        dtm_path=fetched_dtm_path,
        output_path=ALIGNED_OUTPUT_PATH
    )

    print("\n========== PIPELINE COMPLETED ==========")
    print("Downloaded DTM:", fetched_dtm_path)
    print("Aligned terrain:", ALIGNED_OUTPUT_PATH)
    print("========================================")
