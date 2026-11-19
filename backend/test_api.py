import json
import shutil
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds
from fastapi.testclient import TestClient

from backend.main import app, OUTPUTS_DIR, UPLOADS_DIR
from backend.jobs import create_job, update_job, get_job, list_jobs

client = TestClient(app)
SAMPLE_CROP_PATH = Path(__file__).resolve().parent.parent / "data" / "samples" / "crop.tif"


def test_home_endpoint():
    """Test the API root health check."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "DepthWizard" in data["name"]


def test_list_jobs():
    """Test the GET /jobs endpoint."""
    response = client.get("/jobs")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_upload_invalid_extension():
    """Test upload fails with non-TIFF files."""
    response = client.post(
        "/upload",
        files={"file": ("test.txt", b"not a tiff", "text/plain")},
    )
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


def test_upload_corrupt_tiff():
    """Test upload fails with corrupted TIFF files."""
    response = client.post(
        "/upload",
        files={"file": ("corrupt.tif", b"corrupted data", "image/tiff")},
    )
    assert response.status_code == 400
    assert "Invalid satellite GeoTIFF" in response.json()["detail"]


def test_nonexistent_job_status():
    """Test 404 for unknown job ID."""
    response = client.get("/status/nonexistent-id-12345")
    assert response.status_code == 404


def test_nonexistent_job_result():
    """Test 404 for unknown job ID in results."""
    response = client.get("/result/nonexistent-id-12345")
    assert response.status_code == 404


def test_path_traversal_prevention():
    """Test that path traversal attempts are rejected."""
    test_id = "test-traversal-id"
    create_job(test_id, "dummy.tif", str(OUTPUTS_DIR / test_id))

    # Starlette normalizes raw /../ in URLs, returning 404 because no single-param /files route exists
    resp1 = client.get(f"/files/{test_id}/../secret.txt")
    assert resp1.status_code in [400, 404]

    # Directly invoking endpoint logic with directory traversal raises 400
    from backend.main import download_file
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        download_file(test_id, "../secret.txt")
    assert exc.value.status_code == 400


def test_end_to_end_pipeline_and_api():
    """
    End-to-end test:
    1. Upload valid GeoTIFF (crop.tif).
    2. Background task processes image and fetches terrain.
    3. Status transitions to 'done'.
    4. Verify metadata.json adheres to README Section 5.3 contract.
    5. Verify all generated output files can be retrieved via /files/{job_id}/{filename}.
    6. Verify contents of objects_placed.geojson and objects_scene.json (for Three.js).
    """
    assert SAMPLE_CROP_PATH.exists(), f"Sample file not found: {SAMPLE_CROP_PATH}"

    def mock_fetch(satellite_path, output_path, **kwargs):
        dest = Path(output_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        west, south, east, north = 77.30, 13.05, 77.36, 13.11
        transform = from_bounds(west, south, east, north, 100, 100)
        dtm_data = np.linspace(800.0, 900.0, 100 * 100, dtype=np.float32).reshape((100, 100))

        with rasterio.open(
            str(dest), "w",
            driver="GTiff", height=100, width=100, count=1,
            dtype="float32", crs="EPSG:4326", transform=transform, nodata=-9999.0
        ) as dst:
            dst.write(dtm_data, 1)
        return str(dest)

    with patch("backend.pipeline_runner.fetch_dtm", side_effect=mock_fetch):
        with open(SAMPLE_CROP_PATH, "rb") as f:
            upload_resp = client.post(
                "/upload",
                files={"file": ("crop.tif", f, "image/tiff")},
            )

        assert upload_resp.status_code == 202
        body = upload_resp.json()
        assert "job_id" in body
        job_id = body["job_id"]

        # 1. Verify status is 'done' after background execution
        status_resp = client.get(f"/status/{job_id}")
        assert status_resp.status_code == 200
        assert status_resp.json()["status"] == "done"

        # 2. Verify result metadata adhering to README Section 5.3
        result_resp = client.get(f"/result/{job_id}")
        assert result_resp.status_code == 200
        res_data = result_resp.json()

        assert res_data["job_id"] == job_id
        assert res_data["input_georeferenced"] is True
        assert "EPSG:32643" in res_data["crs"]
        assert "extent" in res_data
        assert res_data["width"] == 512
        assert res_data["height"] == 512
        assert "terrain" in res_data
        assert res_data["terrain"]["min_elevation_m"] <= res_data["terrain"]["max_elevation_m"]
        assert "objects" in res_data
        assert res_data["objects"]["count"] > 0
        assert "files" in res_data

        expected_files = [
            "texture.png",
            "terrain_dem.tif",
            "heightmap16.png",
            "objects.geojson",
            "objects_placed.geojson",
            "objects_scene.json",
            "metadata.json",
        ]
        for ef in expected_files:
            assert ef in res_data["files"], f"Missing {ef} in metadata files list"

        # 3. Test downloading each output file via /files/{job_id}/{filename}
        for ef in expected_files:
            file_resp = client.get(f"/files/{job_id}/{ef}")
            assert file_resp.status_code == 200, f"Failed to download {ef}: {file_resp.status_code}"
            assert len(file_resp.content) > 0, f"Downloaded {ef} is empty"

        # 4. Check specific contents
        # objects_placed.geojson
        placed_resp = client.get(f"/files/{job_id}/objects_placed.geojson")
        placed_json = placed_resp.json()
        assert placed_json["type"] == "FeatureCollection"
        for feat in placed_json["features"]:
            props = feat["properties"]
            assert "ground_elevation_m" in props
            assert props["ground_elevation_m"] is not None
            if props.get("height_above_ground_m") is not None:
                assert props["top_elevation_m"] == round(
                    props["ground_elevation_m"] + props["height_above_ground_m"], 2
                )

        # objects_scene.json (for Three.js 3D rendering)
        scene_resp = client.get(f"/files/{job_id}/objects_scene.json")
        scene_json = scene_resp.json()
        assert "origin_crs" in scene_json
        assert "origin_sw" in scene_json
        assert "objects" in scene_json
        assert len(scene_json["objects"]) > 0
        for obj in scene_json["objects"]:
            assert "id" in obj
            assert "class" in obj
            assert "base_y" in obj
            assert obj["base_y"] >= 0.0
            if obj["class"] == "building":
                assert "footprint_xz" in obj
            elif obj["class"] == "tree":
                assert "position_xz" in obj

        # Cleanup test artifacts
        shutil.rmtree(OUTPUTS_DIR / job_id, ignore_errors=True)
        shutil.rmtree(UPLOADS_DIR / job_id, ignore_errors=True)
