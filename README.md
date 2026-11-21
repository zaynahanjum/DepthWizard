# Calibrating AI Depth Models with Real-World Geographic Constraints

> Georeferenced satellite RGB image + DEM terrain → ML-detected buildings and trees with heights in metres → interactive 3D flythrough.

**Team:** B G R Siddu, Khatija Kaneez, Zaynah Anjum, Jenisha Dsouza
**Guide:** Dr. Joyline Dsa
**Dept:** Computer Science and Engineering, Sahyadri College of Engineering and Management

> 📝 **This README is a living document.** Anyone on the team can edit it. If you change a folder, a file format, an API route, or a setup step, update this file in the same commit. Add a line to the [Changelog](#14-changelog) at the bottom.
>
> The project title comes from our poster. The approach described below is the **current plan** and replaces the poster's "relative depth → absolute DSM" description where they differ.

---

## 1. What are we building?

An **interactive 3D environment built from georeferenced RGB satellite imagery**. It combines:

- **Terrain elevation** from a **DEM** (Digital Elevation Model). A DEM is elevation data, not an AI model.
- **Objects detected from the RGB image** (buildings, trees, and later possibly vegetation and roads), each with a footprint/location and an estimated **height above ground in metres**.
- **A rendering layer** that stands the objects on the terrain and lets the user fly around (Three.js in the browser; Unity for the standalone app).

A plain RGB image has no height information, and a generic relative-depth model does not give heights in metres. So our ML module is trained to predict **real heights in metres** from overhead imagery, using datasets that contain true height labels. Relative-depth outputs are **not** used as metric heights.

**Scope:** georeferenced RGB images (e.g. GeoTIFF) only. Non-georeferenced images (PNG/JPG) may be explored later.

---

## 2. Who does what

| Module | Owner | Folder | One-line job |
|---|---|---|---|
| **ML: object and height estimation** | Siddu | `ml/` | Image in → objects (class, footprint, height in metres) out as `objects.geojson` |
| **Terrain, pipeline and backend** | Zaynah | `pipeline/`, `backend/` | DEM → terrain grid, combine with objects, export files, serve results |
| **Frontend (incl. Three.js flythrough)** | Jenisha | `frontend/` | Upload page, result preview, validation display, browser 3D flythrough |
| **Unity (3D)** | Khatija Kaneez | `unity/` | Builds terrain and objects, flythrough, height/slope tools |

> Everyone should read Sections 4 and 5, since they are the contract between modules.

---

## 3. Tech stack

| Layer | Tools |
|---|---|
| ML | Python 3.10+, PyTorch, NumPy, OpenCV, rasterio, shapely, pyproj. Segmentation library (e.g. `segmentation_models_pytorch`) is a candidate, to be verified |
| ML training | Free cloud GPU (Google Colab / Kaggle). Our laptops have no CUDA GPU |
| ML inference | CPU, tile-based, on a laptop |
| Terrain / pipeline | Python, rasterio (read/reproject/resample GeoTIFF), pyproj, shapely, NumPy |
| Backend | Python + FastAPI (suggested), Uvicorn |
| Frontend | HTML/JS or React; browser flythrough in `frontend/flythrough/` (Three.js + Vite) |
| Unity | Unity (C#): terrain from heightmap/mesh, objects built from exported geometry |
| Formats | **GeoTIFF** (georeferenced rasters), **GeoJSON** (vector objects), PNG (texture, 16-bit heightmap), JSON (metadata, scene file) |
| Version control | Git + GitHub |

---

## 4. System workflow

### 4.1 Three different height quantities (do not mix them up)

| Quantity | Meaning | Where it comes from |
|---|---|---|
| **Terrain elevation** | Height of the bare ground above a vertical reference | **DEM** (measured/derived elevation data, not an AI model) |
| **Object height above ground** | How tall an object is above the ground beneath it (metres) | **ML model** (predicted) |
| **Absolute top elevation** | Elevation of a roof/top surface | **Derived**: terrain elevation + object height |

Example: DEM ground = 100 m, ML predicts a building height of 20 m → roof elevation = **120 m**, *assuming compatible vertical references*.

### 4.2 Two parallel inputs, then combine

```
 PATH A (ML, Siddu)                          PATH B (Terrain, Zaynah)

 Georeferenced RGB image                     DEM
        │                                      │
        ▼                                      ▼
 ML model (class + height)           Terrain-data processing
        │                                      │
        ▼                                      ▼
 Object predictions:                  Georeferenced terrain
 class, footprint,                    elevation grid (aligned
 location, height (m)                 to the RGB image)
 (objects.geojson)                    (terrain_dem.tif)
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
        Spatial alignment and combination
        (place objects on terrain, derive top elevations)
                       ▼
        Exported terrain + object data
                       ▼
        Backend → Three.js / Unity integration
                       ▼
        Interactive 3D environment
```

The **backend is a separate component**: it receives inputs, manages jobs and serves results. It does not do ML or terrain maths itself; it calls `pipeline.run_pipeline()`.

```
FRONTEND ──POST /upload──▶ BACKEND ──run_pipeline()──▶ PIPELINE (calls ML + terrain)
    ▲                         │                                │
    │      GET /result        │◀──── outputs/<job_id>/ ────────┘
    └─────────────────────────┤
          UNITY / THREE.JS ◀──GET /files/<job_id>/...
```

### 4.3 Step by step

1. **Upload:** user uploads a georeferenced RGB image and a DEM (or a DEM source is chosen; open question).
2. **Job creation:** backend saves files in `data/uploads/`, creates a `job_id`, calls `run_pipeline()`.
3. **Path A:** `ml.predict_objects()` reads the image and writes `objects.geojson`.
4. **Path B:** `pipeline/terrain.py` loads the DEM, reprojects/resamples/crops it to the RGB image's extent and writes `terrain_dem.tif`.
5. **Combine:** `pipeline/combine.py` samples ground elevation under each object, computes absolute top elevation, converts coordinates to the viewer's local frame.
6. **Export:** `pipeline/export.py` writes all output files (Section 5.3).
7. **Serve:** backend marks the job `done` and serves files over HTTP.
8. **Preview (Frontend):** shows status, metadata, and any validation numbers.
9. **3D view (Three.js / Unity):** builds terrain from the heightmap/DEM, applies the RGB texture, creates objects from `objects_scene.json`.

### 4.4 Confirmed vs. still to investigate

**Confirmed**
- Input is a georeferenced RGB image plus a DEM for the same area.
- Terrain elevation comes from the DEM; the ML component does not produce it.
- The ML component provides object class, location, footprint and height above ground, in metres.
- Terrain and objects are combined in a separate pipeline step, then exported to the viewers.
- Objects are not forced into a single height number (roads, trees, buildings need different geometry).

**Still to investigate / confirm** (nothing here is assumed to work yet)
- Whether the multi-task model in 4.5 reaches useful accuracy, and whether it transfers from US training data to Indian scenes.
- Whether tree heights are good enough, or only buildings at first.
- Which DEM source (user-supplied, SRTM, Copernicus, other), its resolution, and its vertical datum. A DEM file does not say by itself whether it is a DSM or a DTM; this depends on the product it came from.
- Which high-resolution RGB imagery we can legally use for the demo area.
- How to sample ground elevation under a building footprint (see 5.4).
- What reference data exists for evaluating object heights in our demo area.
- How users choose the area (upload a pre-cropped image vs. select it in the frontend) and the maximum image size.

**Caveats**
- A generic relative-depth model (e.g. Marigold) does **not** give heights in metres. It is not used unless a reliable calibration and validation strategy exists.
- A DEM does not contain building heights. `Height = DSM − DTM` only works when both are high-resolution and measured (e.g. LiDAR). With 30 m global DEMs it cannot give per-building heights, because a building is smaller than one pixel.
- Low-resolution imagery (e.g. 10 m Sentinel-2) cannot show building outlines. The ML module needs imagery at roughly 0.3 to 1.5 m per pixel.
- A georeferenced RGB image does not always contain enough information to recover true building heights. Every height is an estimate with an error that we must measure.

### 4.5 ML approach (current plan)

**Architecture:** one multi-task network (shared encoder, two outputs):
1. **Class head:** building / tree / other, per pixel.
2. **Height head:** nDSM (height above ground, in metres) per pixel, trained with supervised regression on real height labels.

**Postprocessing** (`ml/postprocess.py`):
- Class mask → building footprints (polygons) and tree points with crown size.
- Height per object = robust statistic of the predicted nDSM inside the object (starting point: median for buildings, about the 90th percentile for trees; chosen by validation).
- Pixel positions → real coordinates using the image's geotransform → WGS84 lon/lat for `objects.geojson`.
- Placing objects vertically on the DEM is **not** done by ML; the pipeline does it (Section 5.4).

**Candidate datasets** (verify availability and licence before use):

| Dataset | What it offers | Planned use |
|---|---|---|
| GAMUS | RGB tiles with nDSM and six classes including building and tree (US cities) | Primary training data |
| DFC2019 | Image / nDSM / semantic triplets at 1.3 m (Jacksonville, Omaha) | Extra or backup training data |
| Google Open Buildings 2.5D Temporal | Model-derived building heights, South Asia coverage, 4 m effective resolution | Local comparison only, **not ground truth** |
| Meta/WRI canopy height maps | 1 m model-derived canopy heights | Tree-height comparison only, **not ground truth** |

**Hardware:** training on a free cloud GPU; inference on a CPU laptop with a small encoder on 512×512 tiles (speed to be measured).

**Evaluation:** MAE and RMSE in metres, separately for buildings and trees, plus footprint IoU. In-domain test data (held-out tiles from the training dataset) and local out-of-domain data are reported **separately**, and a trivial baseline (e.g. predicting the average height) is included. We report no accuracy numbers until we measure them.

---

## 5. Interface contracts (do not change without telling the team)

### 5.1 ML → Pipeline: object predictions

**Function (Siddu provides):**
```python
# ml/predict.py
def predict_objects(image_path: str, output_path: str) -> dict:
    """
    image_path  : georeferenced RGB image (GeoTIFF)
    output_path : where to write objects.geojson
    returns     : small summary dict (object count, classes, model name/version)
    """
```
`ml/predict.py` is currently a **stub** that writes fake objects (marked `"stub": true`). It will be replaced by real inference without changing the signature or the format below.

**File format: `objects.geojson`** (GeoJSON FeatureCollection, WGS84 lon/lat, as the GeoJSON standard requires).

Each feature has a geometry and these properties:

| Property | Required | Meaning |
|---|---|---|
| `id` | yes | Unique object ID, e.g. `"b_0001"` |
| `class` | yes | `building`, `tree`, `vegetation`, `road`, `other` |
| `height_above_ground_m` | yes (key must exist) | Height above the ground beneath the object, in metres. `null` if not estimated; never `0` as a guess |
| `height_source` | yes | `"ml"`, `"dummy"` or `"none"` |
| `confidence` | optional | 0 to 1 |
| `height_method` | optional | How the height was computed, e.g. `"ndsm_median"` |
| `width_m` | roads | Road width in metres |
| `crown_radius_m` | trees, optional | Approximate tree crown radius |
| `roof_type` | buildings, optional | e.g. `flat`, `gabled`. Optional, may be unknown |

**Geometry by class (one height number is not enough for everything):**

| Class | Geometry | Notes |
|---|---|---|
| `building` | `Polygon` (footprint) | Extruded by `height_above_ground_m` |
| `tree` | `Point` | Needs height and optionally crown radius; viewer uses a tree model/prefab |
| `vegetation` | `Polygon` | Area patch; height optional |
| `road` | `LineString` + `width_m` | Placed on (draped over) the terrain surface; height is `null`/0 |
| `other` | any | Rendered as simple placeholder unless agreed otherwise |

Any additional rendering properties should be added to this table, so both sides know them. Unknown properties must be ignored, not crash anything. `python -m ml.validate_objects <file>` checks a file against this contract.

### 5.2 Terrain component outputs

Provided by the pipeline (Zaynah), separately from the objects:

| Item | Description |
|---|---|
| DEM elevation values | `terrain_dem.tif`: single-band GeoTIFF, elevation in metres, aligned to the RGB image extent |
| Raster dimensions | width × height in pixels |
| Spatial resolution | pixel size (metres, or degrees if the CRS is geographic) |
| CRS | e.g. `EPSG:32643`; a projected CRS in metres is preferred for geometry maths |
| Geographic extent | bounding box in the CRS and in lon/lat |
| Vertical reference | datum/units of the DEM (e.g. which geoid). **Must be recorded; confirm for the chosen DEM source** |

### 5.3 Output files per job: `outputs/<job_id>/`

| File | Description | Used by |
|---|---|---|
| `texture.png` | Original RGB image, cropped/resized to the terrain extent | Three.js, Unity, Frontend |
| `terrain_dem.tif` | DEM aligned to the image (GeoTIFF, metres) | Pipeline, validation, GIS |
| `heightmap16.png` | **Terrain only** (from the DEM) as 16-bit grayscale | Three.js, Unity |
| `objects.geojson` | Raw object predictions (ML or dummy) | Pipeline, Frontend |
| `objects_placed.geojson` | Same objects plus `ground_elevation_m` and derived `top_elevation_m` | Validation, GIS |
| `objects_scene.json` | Objects in viewer-friendly local coordinates (below) | Three.js, Unity |
| `metadata.json` | See below | Everyone |

**`dsm.tif` has been removed.** Its old meaning ("absolute DSM from relative depth") no longer applies. If we later want a combined surface raster (DEM plus rasterised object heights), it can be added as `surface_model.tif` with its meaning defined here first. An RGB-derived object-height map must never be labelled as terrain elevation.

**Objects are not forced into the grayscale heightmap.** `heightmap16.png` is terrain only; objects travel as geometry.

**Height conversion for the terrain heightmap:**
`elevation_m = min_elevation_m + (pixel / 65535) × (max_elevation_m − min_elevation_m)`

**`objects_scene.json` (proposed; confirm with the Unity and Three.js owners):** a local frame so viewers do not need CRS maths. Origin = terrain's south-west corner, `x` = east (m), `z` = north (m), `y` = up (m, elevation relative to `terrain.min_elevation_m`).

```jsonc
{
  "origin_crs": "EPSG:32643",
  "objects": [
    { "id": "b_0001", "class": "building",
      "footprint_xz": [[10,20],[30,20],[30,40],[10,40]],
      "base_y": 41.2, "height_m": 12.0 },
    { "id": "t_0001", "class": "tree", "position_xz": [55,70],
      "base_y": 38.0, "height_m": 7.5, "crown_radius_m": 2.0 },
    { "id": "r_0001", "class": "road", "path_xz": [[0,5],[50,8],[120,15]], "width_m": 6.0 }
  ]
}
```

**`metadata.json`:**
```jsonc
{
  "job_id": "abc123",
  "input_georeferenced": true,
  "crs": "EPSG:32643",
  "extent": { "min_x": 0, "min_y": 0, "max_x": 0, "max_y": 0 },   // fill with real values
  "width": 1024,
  "height": 1024,
  "pixel_size_m": 0.5,
  "texture": { "width": 1024, "height": 1024 },                    // optional
  "terrain": {
    "source": "SRTM",                 // or other DEM name
    "resolution_m": 30,
    "vertical_reference": "to be recorded",
    "min_elevation_m": 12.4,
    "max_elevation_m": 88.9
  },
  "objects": {
    "source": "dummy",                // "dummy" or "ml"
    "model": null,
    "count": 120,
    "classes": ["building", "tree", "road", "vegetation"],
    "height_meaning": "height above local ground, metres"
  },
  "derived": { "top_elevation": "terrain ground elevation + height_above_ground_m" },
  "evaluation": { "terrain": null, "object_height": null }   // null if no reference data
}
```

### 5.4 How the two components align, and how heights are used

1. **Same CRS.** The RGB image's georeferencing defines the extent and CRS. ML converts pixel positions to geographic coordinates using the image's own geotransform and writes `objects.geojson` in WGS84.
2. **DEM aligned to the image.** The pipeline reprojects, resamples and crops the DEM to the image extent (`terrain_dem.tif`). A coarse DEM (e.g. 30 m) will be much blurrier than the image; this limitation is expected and recorded in `metadata.json`.
3. **Reproject objects** into the terrain's projected CRS (metres) for geometry maths.
4. **Ground elevation:** for each object, sample the DEM under it: for buildings, a value from the footprint (proposal: the **minimum** or **mean** DEM value inside the footprint, **to be confirmed**); for trees, the DEM at the point; for roads, the DEM along the line.
5. **Positioning:** `top_elevation_m = ground_elevation_m + height_above_ground_m`. The object's base sits at ground elevation and extends up by its height. Roads are draped on the terrain surface, with no vertical extrusion.
6. **Assumption:** the DEM and predicted heights use compatible vertical references. Because predicted heights are *above ground* (relative), they only need the DEM for the base; absolute top elevation is meaningful only if the DEM's vertical reference is known.

### 5.5 Backend API (routes unchanged)

| Method | Route | Purpose |
|---|---|---|
| POST | `/upload` | Upload the georeferenced image and the DEM file. Returns `{ "job_id": "..." }` |
| GET | `/status/{job_id}` | `queued`, `running`, `done` or `failed` |
| GET | `/result/{job_id}` | Returns the `metadata.json` content |
| GET | `/files/{job_id}/{filename}` | Download any output file |

Only change: `/upload` now accepts a DEM as well as the image. Backend runs on `http://localhost:8000` during development.

**Backend calls one function (Zaynah provides):**
```python
# pipeline/pipeline.py
def run_pipeline(image_path: str, dem_path: str, output_dir: str, use_dummy_objects: bool = False) -> dict:
    """Runs Path A (or dummy objects) and Path B, combines, exports. Returns metadata dict."""
```

---

## 6. Folder structure

```
project-root/
├── README.md
├── .gitignore
│
├── ml/                         # ML (Siddu)
│   ├── __init__.py             # marks ml/ as a Python package (keep it)
│   ├── predict.py              # predict_objects(): the only entry point (stub for now)
│   ├── postprocess.py          # class mask + height map → footprints, points, heights → GeoJSON
│   ├── model.py                # multi-task network definition
│   ├── dataset.py              # training data loader
│   ├── train.py                # training script (run on Colab/Kaggle GPU)
│   ├── evaluate_objects.py     # MAE / RMSE in metres, footprint IoU
│   ├── check_geotiff.py        # checks an input image is georeferenced
│   ├── crop_image.py           # crops a small area out of a large GeoTIFF
│   ├── validate_objects.py     # checks objects.geojson against the contract
│   ├── run_all.sh              # Linux: check → predict → validate
│   ├── requirements.txt
│   └── notebooks/              # model investigation notes and experiments
│
├── pipeline/                   # Terrain + combination (Zaynah)
│   ├── pipeline.py             # run_pipeline()
│   ├── terrain.py              # load/reproject/resample/crop DEM → terrain_dem.tif
│   ├── combine.py              # place objects on terrain, derive top elevations
│   ├── export.py               # writes all output files for the viewers
│   ├── mock_data.py            # generates dummy objects.geojson for testing
│   └── evaluate_terrain.py     # terrain checks vs reference, if reference exists
│
├── backend/                    # Backend (Zaynah)
│   ├── main.py                 # FastAPI app and routes
│   ├── jobs.py                 # job ids, status tracking
│   └── requirements.txt
│
├── frontend/                   # Frontend (Jenisha)
│   ├── flythrough/             # Three.js + Vite terrain flythrough
│   └── ...
│
├── tools/
│   └── export_viewer.py        # GeoTIFF → heightmap16.png / texture.png / metadata.json
│
├── unity/                      # Unity project (Khatija Kaneez)
│   ├── Assets/
│   ├── Packages/
│   └── ProjectSettings/
│
├── data/
│   ├── samples/                # small sample image, sample DEM, sample_output/ (committed, small)
│   ├── uploads/                # runtime uploads (git-ignored)
│   └── reference/              # DEM / reference data for evaluation
│
├── outputs/                    # per-job results (git-ignored)
│   └── <job_id>/
│
└── docs/                       # diagrams, poster, report
```

Files marked as planned (`postprocess.py`, `model.py`, `dataset.py`, `train.py`, `evaluate_objects.py`) may not exist yet. Update this list as they are added.

---

## 7. Setup

**Linux**
```bash
git clone <repo-url>
cd project-root

python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
pip install -r backend/requirements.txt

# system libraries needed by rasterio on some distros
sudo apt install gdal-bin libgdal-dev
```

**Windows (Command Prompt)**
```
git clone <repo-url>
cd project-root

python -m venv .venv
.venv\Scripts\activate
pip install -r ml\requirements.txt
pip install -r backend\requirements.txt
```

Always run commands from the **project root**, with the virtual environment active (the prompt shows `(.venv)`).

**ML commands (from the project root)**
```bash
python -m ml.check_geotiff data/samples/crop.tif                         # is the image georeferenced?
python -m ml.crop_image --input BIG.tif --output data/samples/crop.tif --pixels 5000 5000 512 512
python -m ml.predict --image data/samples/crop.tif --output outputs/test1/objects.geojson
python -m ml.validate_objects outputs/test1/objects.geojson              # matches the contract?
bash ml/run_all.sh data/samples/crop.tif outputs/test1                   # Linux: all three checks
```
On Windows use backslashes in paths and run the three `python -m` commands individually (the `.sh` script needs a Linux shell or Git Bash).

**Run the backend**
```bash
uvicorn backend.main:app --reload --port 8000
```

**Frontend:** open `frontend/index.html` or run its dev server (add the command here once decided).
**3D flythrough (Three.js):** `cd frontend/flythrough && npm install && npm run dev`. See `frontend/flythrough/README.md` for loading real DEM output.
**Unity:** open the `unity/` folder in Unity Hub (use the same Unity version on every machine, write it here: `Unity ____`).

> Note: the other modules can start without waiting for the real ML model. See Section 9.

---

## 8. Git workflow

1. **Never push directly to `main`.** `main` must always run.
2. Each person works on their own branch: `ml/…`, `pipeline/…`, `backend/…`, `frontend/…`, `unity/…`
   Example: `git checkout -b ml/postprocess`
3. Commit small and often, with clear messages (`ml: add footprint vectorisation`).
4. Before opening a PR: `git pull origin main` and fix conflicts on your side.
5. Open a Pull Request into `main`. At least one other teammate reviews it.
6. **Stay in your folder.** If you need a change in someone else's folder, ask them or mention it in the PR.
7. **Unity:** commit `.meta` files, and do **not** commit `Library/`, `Temp/`, `Logs/`, `obj/` (see `.gitignore` below). Avoid two people editing the same scene at once; use prefabs.
8. Large files (models, big images, datasets, builds) go on a shared drive, **not** Git. Add a `git add` by file name, never `git add .`, so a large file cannot slip in.

`.gitignore` (minimum):
```
.venv/
__pycache__/
data/uploads/
outputs/
data/samples/sample_image.tif
*.pth
*.pt
unity/Library/
unity/Temp/
unity/Logs/
unity/obj/
unity/Builds/
node_modules/
```

---

## 9. How to work in parallel (mock data)

Nobody should be blocked waiting for someone else.

- **ML (Siddu)** provides `ml/predict.py` as a stub that writes a valid but **fake** `objects.geojson` inside the real image area, plus small sample files in `data/samples/` (`crop.tif`, `sample_output/objects.geojson`). The real model replaces the stub body later; the signature and format stay the same.
- **Pipeline/backend (Zaynah)** can use the stub output or generate her own dummy objects (`pipeline/mock_data.py`): buildings with footprints and heights, trees with heights, roads with width, vegetation patches, one object with `null` height, and a building on sloped ground. A sample DEM can be a small real tile (check licence and vertical datum) or a synthetic GeoTIFF with a valid CRS and geotransform. The DEM must cover the same area as the sample image (`python -m ml.check_geotiff` prints its bounds).
- **Frontend and Unity** build against `data/samples/sample_output/` and the backend's dummy responses.
- When the real model is ready, `run_pipeline(..., use_dummy_objects=False)` uses real predictions, `height_source` changes from `"dummy"` to `"ml"`, and `metadata.json` records the model. Nothing else should change **if everyone followed Section 5**. If the model cannot give a field (e.g. tree heights), it writes `null` and viewers fall back to defaults.

---

## 10. Milestones and integration plan

| Phase | Goal | Done when |
|---|---|---|
| 1. Agree | Freeze contracts in Section 5, create repo, assign owners | Everyone can clone and run the sample commands |
| 2. Standalone | Each module works alone with sample/dummy data | Stub produces valid `objects.geojson`; pipeline combines it with a DEM; backend serves it; viewers render it |
| 3. ML data and postprocessing | Dataset subset loaded; `postprocess.py` tested with **ground-truth** masks and heights | Recovered heights and locations match known values on synthetic and real labelled tiles |
| 4. ML model | Multi-task model trained on a cloud GPU; MAE/RMSE measured on held-out tiles | Metrics reported per class, with a baseline for comparison |
| 5. Real inference | CPU tile-based inference replaces the stub in `predict_objects()` | Real `objects.geojson` passes `validate_objects` and renders in the viewers |
| 6. Local evaluation | Check results on a local (Indian) area against proxy references | Agreement and limitations documented honestly |
| 7. Polish | Click-to-read height, slope tool, view modes, UI, stability, standalone build | Demo-ready, README and docs complete |

**Weekly rhythm:** a short sync (what's done, what's blocked, any contract changes), then merge to `main`.

---

## 11. Evaluation

Terrain elevation and object height are **different quantities** and are evaluated separately, each against an appropriate reference **when one is available**. No accuracy numbers exist yet.

| What | Compared against | Metrics | Owner |
|---|---|---|---|
| Object height above ground | Held-out tiles of the training dataset (in-domain) | MAE, RMSE in metres, per class (building, tree) | Siddu (`evaluate_objects.py`) |
| Object height on a local area | Proxy references (e.g. OSM height or floor-count tags, model-derived products) | Agreement, reported as **agreement, not accuracy** | Siddu |
| Footprints / classes | Reference masks, where available | IoU, precision, recall | Siddu |
| Terrain elevation (after resampling/alignment) | Reference elevation data, if available | RMSE, MAE, correlation | Zaynah (`evaluate_terrain.py`) |

In-domain and out-of-domain results are never mixed, and a trivial baseline (e.g. predicting the average height) is always reported next to the model.

The original problem statement scores **DSM accuracy (50%)** and **visualization (50%)**. Our terrain and object heights together make up a top surface (`DEM + object height`); whether we can compare that to a reference DSM depends on what reference data we find. Confirm this with the guide. Visualization (projection accuracy, visual fidelity, navigability, UI, stability, standalone deployment) is owned by the Frontend and Unity members.

---

## 12. Module-specific notes

**ML:** Keep functions small and testable. Build and test postprocessing with ground-truth data before any model exists. The model loads once, not per request. Process large images in tiles and never feed a huge GeoTIFF to the model at once (use `crop_image.py` while developing). Unknown height is `null`, never a guess. Record model name and version in the summary dict. Document limitations as they are found.

**Pipeline (Zaynah):** Always check CRS before any operation. Keep reprojection in one place. Log the DEM's resolution and vertical reference into `metadata.json`. Handle `null` heights. Reject images that are too large, and check that the DEM and image extents overlap, with a clear error message.

**Backend (Zaynah):** Run the pipeline in a background task so uploads don't hang. Return clear errors (`failed` + message).

**Frontend (Jenisha):** Show the job status while waiting. Display `metadata.json` values (terrain source, object source, object counts, metrics if available) clearly. Provide a way to open the 3D view.

**Unity (Khatija Kaneez):** Read `metadata.json` first, then build terrain from `heightmap16.png` (conversion in 5.3), apply `texture.png`, then create objects from `objects_scene.json`: buildings extruded from footprints, trees as models, roads draped on the terrain, vegetation as patches. Required: first-person flight, click for height, slope between two points, view modes. Make a standalone Linux/Windows build at the end.

---

## 13. Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| `No module named ml` | You are not in the project root, or `ml/__init__.py` is missing or misnamed |
| `ModuleNotFoundError: rasterio` | Virtual environment not active, or `pip install -r ml/requirements.txt` not run |
| `NOT georeferenced` from `check_geotiff` | The image has no CRS; use another export or image |
| Objects look huge or building outlines unreadable | Image resolution too coarse (e.g. 10 m pixels). The model needs imagery around 0.3 to 1.5 m per pixel |
| Model does not run on a huge image | Crop or tile it first (`ml/crop_image.py`) |
| `outputs/` or the big sample image not pushed | Intentional: they are in `.gitignore`. Share small files only, large ones via a shared drive |
| Unity terrain looks flat | Heightmap not rescaled using `min_elevation_m` / `max_elevation_m` from metadata; or the DEM is very coarse for a small area |
| Objects float above or sink below terrain | Ground elevation sampled wrongly; check CRS match and the sampling rule (5.4); check that `base_y` is relative to the same minimum elevation as the terrain |
| Objects in the wrong place / shifted | CRS mismatch, or lon/lat vs x/y swapped. Check the order (GeoJSON is lon, lat) |
| Texture and terrain misaligned | Image and DEM not cropped to the same extent; check `terrain_dem.tif`, `texture.png` and metadata sizes |
| DEM looks blocky next to the image | Expected if the DEM resolution is coarser than the image; record it, do not hide it |
| Roof elevations look wrong | Vertical reference of the DEM unknown or mismatched; check `metadata.json` |
| Objects have `null` heights | Model does not estimate them; viewers should use defaults, not crash |
| `activate` not found on Windows | Use `.venv\Scripts\activate` (Command Prompt), not `source` |
| rasterio install fails on Linux | Install GDAL system packages (Section 7) |
| Merge conflict in Unity scene | Don't edit the same scene together; use prefabs; re-pull before editing |

---

## 14. Changelog

_Add a line for every change to contracts, structure, or setup._

| Date | Who | Change |
|---|---|---|
| 2026-10-17 | Siddu | Initial README created |
| 2026-10-25 | Siddu | Sections 4 and 5 rewritten: workflow now has two parallel paths (ML objects + DEM terrain); new object data contract (GeoJSON), terrain outputs and output files; `dsm.tif` removed from the contract |
| 2026-11-19 | 3D flythrough | Added `frontend/flythrough/` (Three.js terrain flythrough) and `tools/export_viewer.py` (GeoTIFF to heightmap16.png / texture.png / metadata.json). Optional `texture: {width, height}` block in `metadata.json` |
| 2026-11-21 | Siddu | README aligned with the new ML approach: multi-task object-class + height model trained on labelled height data; relative-depth/DSM calibration removed from Sections 1, 3 and 6; owner names added; ML tooling (`crop_image`, `check_geotiff`, `validate_objects`, stub `predict`) documented; Windows setup, evaluation plan, milestones and troubleshooting updated; optional `height_method` property added to the object contract |

---

## References

1. Hu, M., et al. (2024). Metric3D v2: Zero-shot metric depth and surface normal estimation. *IEEE TPAMI*.
2. Xu, Z., et al. (2025). Dual branch multiscale stereo matching for satellite images. *IEEE JSTARS*, 18, 949–964.
3. Chen, Z., et al. (2024). Surface depth estimation from multiview stereo satellite images. *IEEE JSTARS*, 17, 17837–17845.
4. Chen, S., et al. (2023). HTC-DC Net: Monocular height estimation from remote sensing images. *IEEE TGRS*, 61, 1–18.
5. Karatsiolis, S., Kamilaris, A., & Cole, I. (2021). IMG2nDSM: Height estimation from single airborne RGB images with deep learning. *Remote Sensing*, 13(12), 2417.
6. Hawker, L., et al. (2022). A 30 m global map of elevation with forests and buildings removed. *Environmental Research Letters*, 17(2), 024016.

_References 1 to 4 come from the poster. References 5 and 6 are background for the height-estimation approach and the DEM discussion; neither means that code, weights or data from those works are used yet._