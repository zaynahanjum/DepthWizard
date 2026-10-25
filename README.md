# Calibrating AI Depth Models with Real-World Geographic Constraints

> Single-view satellite/aerial RGB image → metric elevation map (DSM) → interactive 3D flythrough.

**Team:** B G R Siddu, Khatija Kaneez, Zaynah Anjum, Jenisha Dsouza
**Guide:** Dr. Joyline Dsa
**Dept:** Computer Science and Engineering, Sahyadri College of Engineering and Management

> 📝 **This README is a living document.** Anyone on the team can edit it. If you change a folder, a file format, an API route, or a setup step, update this file in the same commit. Add a line to the [Changelog](#14-changelog) at the bottom.

---

## 1. What are we building?

A standard RGB image has no height data. An AI depth model can tell us *"A is taller than B"* (relative depth) but not *"A is 23 m tall"* (metric height).

Our fix: run a monocular depth model, then **calibrate** its output using known real-world reference points (GPS landmarks with known elevations, low-resolution DEM such as SRTM, or a few Ground Control Points). The result is a metric DSM, which we drape with the original image as a texture and render as a navigable 3D terrain.

Two input modes:

| Input | Example | Output |
|---|---|---|
| Non-georeferenced RGB | PNG / JPG | **rDSM** (relative DSM, no real units) |
| Georeferenced RGB | GeoTIFF | **DSM** (absolute heights in metres) |

---

## 2. Who does what

| Module | Owner | Folder | One-line job |
|---|---|---|---|
| **ML / Elevation Estimation** | Siddu | `ml/` | Image in → depth → calibrated DSM + mesh files out |
| **Backend** | Zaynha| `backend/` | Receives uploads, runs the ML module, stores and serves results |
| **Frontend** | Jenisha | `frontend/` | Upload page, result preview, height validation, launches 3D view |
| **Unity (3D)** | Kaneez | `unity/` | Builds the textured 3D terrain and flythrough, with height/slope tools |

> Fill in the names above. Everyone should read Sections 4 and 5, since they are the contract between modules.

---

## 3. Tech stack

| Layer | Tools |
|---|---|
| ML | Python 3.10+, PyTorch, Depth Anything V2 (pre-trained monocular depth), NumPy, OpenCV, rasterio (GeoTIFF read/write), SciPy |
| Calibration | Linear fit `Elevation = a × Depth + b` against reference points or SRTM, plus Pythagorean geometric checks (line-of-sight slant and horizontal distance) |
| Backend | Python + FastAPI (suggested), Uvicorn |
| Frontend | HTML/JS or React (team's choice, decide in the first meeting) |
| 3D / Visualization | Unity (C#), runtime terrain/mesh built from heightmap + texture |
| Formats | GeoTIFF (DSM), 16-bit PNG (heightmap), PNG/JPG (texture), JSON (metadata) |
| Version control | Git + GitHub |

---

## 4. System workflow

**Goal:** an interactive 3D environment from **georeferenced RGB satellite imagery**, combining DEM terrain elevation with ML-predicted objects (buildings, trees, vegetation, roads, …). Non-georeferenced images may be explored later.

### 4.1 Three different height quantities (do not mix them up)

| Quantity | Meaning | Where it comes from |
|---|---|---|
| **Terrain elevation** | Height of the bare ground above a vertical reference | **DEM** (measured/derived elevation data, not an AI model) |
| **Object height above ground** | How tall an object is above the ground beneath it (metres) | **ML model** (predicted) |
| **Absolute top elevation** | Elevation of a roof/top surface | **Derived**: terrain elevation + object height |

Example: DEM ground = 100 m, ML predicts a building height of 20 m → roof elevation = **120 m**, *assuming compatible vertical references*.

### 4.2 Two parallel inputs, then combine

```
 PATH A (ML, Siddu)                          PATH B (Terrain, backend/pipeline owner)

 Georeferenced RGB image                     DEM
        │                                      │
        ▼                                      ▼
   ML model                          Terrain-data processing
        │                                      │
        ▼                                      ▼
 Object predictions:                  Georeferenced terrain
 class, geometry,                     elevation grid (aligned
 location, height                     to the RGB image)
 (objects.geojson)                    (terrain_dem.tif)
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
        Spatial alignment and combination
        (place objects on terrain, derive top elevations)
                       ▼
        Exported terrain + object data
                       ▼
        Backend / Unity integration
                       ▼
        Interactive 3D environment
```

The **backend is a separate component**: it receives inputs, manages jobs and serves results. It does not do ML or terrain maths itself; it calls `pipeline.run_pipeline()`.

```
FRONTEND ──POST /upload──▶ BACKEND ──run_pipeline()──▶ PIPELINE (calls ML + terrain)
    ▲                         │                                │
    │      GET /result        │◀──── outputs/<job_id>/ ────────┘
    └─────────────────────────┤
                  UNITY ◀──GET /files/<job_id>/...
```

### 4.3 Step by step

1. **Upload:** user uploads a georeferenced RGB image and a DEM (or a DEM source is chosen; open question).
2. **Job creation:** backend saves files in `data/uploads/`, creates a `job_id`, calls `run_pipeline()`.
3. **Path A:** `ml.predict_objects()` reads the image and writes `objects.geojson`.
4. **Path B:** `pipeline/terrain.py` loads the DEM, reprojects/resamples/crops it to the RGB image's extent and writes `terrain_dem.tif`.
5. **Combine:** `pipeline/combine.py` samples ground elevation under each object, computes absolute top elevation, converts coordinates to Unity's local frame.
6. **Export:** `pipeline/export.py` writes all output files (Section 5.3).
7. **Serve:** backend marks the job `done` and serves files over HTTP.
8. **Preview (Frontend):** shows status, metadata, and any validation numbers.
9. **3D view (Unity):** builds terrain from the heightmap/DEM, applies the RGB texture, creates objects from `objects_scene.json`.

### 4.4 Confirmed vs. still to investigate

**Confirmed**
- Input is a georeferenced RGB image plus a DEM for the same area.
- Terrain elevation comes from the DEM; the ML component does not produce it.
- The ML component provides object class, location, geometry and height above ground (where applicable).
- Terrain and objects are combined in a separate pipeline step, then exported to Unity.
- Objects are not forced into a single height number (roads, trees, buildings need different geometry).

**Still to investigate / confirm** (nothing here is assumed to work yet)
- Which pretrained model/approach suits overhead satellite imagery (weights, licence and suitability unknown).
- Whether one model can give class + footprint + height, or we need separate models.
- Whether heights can be estimated for trees, vegetation and roads, or only buildings at first.
- Which DEM source (user-supplied, SRTM, other), its resolution and vertical datum.
- How to sample ground elevation under a building footprint (see 5.4).
- Whether calibration or refinement of predicted heights is needed later (not mandatory now).
- What reference data exists for evaluating object heights.

**Caveats**
- A generic relative-depth model does **not** automatically give building heights in metres.
- A georeferenced RGB image does not necessarily contain enough information to recover true building heights.
- A DEM does not contain building heights, and building heights cannot be calibrated from terrain elevation alone.

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

**File format: `objects.geojson`** (GeoJSON FeatureCollection, WGS84 lon/lat, as the GeoJSON standard requires).

Each feature has a geometry and these properties:

| Property | Required | Meaning |
|---|---|---|
| `id` | yes | Unique object ID, e.g. `"b_0001"` |
| `class` | yes | `building`, `tree`, `vegetation`, `road`, `other` |
| `height_above_ground_m` | where applicable | Height above the ground beneath the object, in metres. `null` if not estimated |
| `height_source` | yes | `"ml"`, `"dummy"` or `"none"` |
| `confidence` | optional | 0 to 1 |
| `width_m` | roads | Road width in metres |
| `crown_radius_m` | trees, optional | Approximate tree crown radius |
| `roof_type` | buildings, optional | e.g. `flat`, `gabled`. Optional, may be unknown |

**Geometry by class (one height number is not enough for everything):**

| Class | Geometry | Notes |
|---|---|---|
| `building` | `Polygon` (footprint) | Extruded by `height_above_ground_m` |
| `tree` | `Point` | Needs height and optionally crown radius; Unity uses a tree model/prefab |
| `vegetation` | `Polygon` | Area patch; height optional |
| `road` | `LineString` + `width_m` | Placed on (draped over) the terrain surface; height is `null`/0 |
| `other` | any | Rendered as simple placeholder unless agreed otherwise |

Any additional rendering properties should be added to this table, so both sides know them. Unknown properties must be ignored, not crash anything.

### 5.2 Terrain component outputs

Provided by the pipeline (backend/pipeline owner), separately from the objects:

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
| `texture.png` | Original RGB image, cropped/resized to the terrain extent | Unity, Frontend |
| `terrain_dem.tif` | DEM aligned to the image (GeoTIFF, metres) | Pipeline, validation, GIS |
| `heightmap16.png` | **Terrain only** (from the DEM) as 16-bit grayscale | Unity |
| `objects.geojson` | Raw object predictions (ML or dummy) | Pipeline, Frontend |
| `objects_placed.geojson` | Same objects plus `ground_elevation_m` and derived `top_elevation_m` | Validation, GIS |
| `objects_scene.json` | Objects in Unity-friendly local coordinates (below) | Unity |
| `metadata.json` | See below | Everyone |

**`dsm.tif` has been removed.** Its old meaning ("absolute DSM from relative depth") no longer applies. If we later want a combined surface raster (DEM plus rasterised object heights), it can be added as `surface_model.tif` with its meaning defined here first. An RGB-derived object-height map must never be labelled as terrain elevation.

**Objects are not forced into the grayscale heightmap.** `heightmap16.png` is terrain only; objects travel as geometry.

**Unity height conversion for the terrain heightmap:**
`elevation_m = min_elevation_m + (pixel / 65535) × (max_elevation_m − min_elevation_m)`

**`objects_scene.json` (proposed; confirm with Unity owner):** a local frame so Unity does not need CRS maths. Origin = terrain's south-west corner, `x` = east (m), `z` = north (m), `y` = up (m, elevation relative to `terrain.min_elevation_m`).

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

**Backend calls one function (backend/pipeline owner provides):**
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
│   ├── pipeline.py             # run_pipeline(): the only entry point
│   ├── depth_model.py          # loads Depth Anything V2, returns relative depth
│   ├── calibration.py          # Elevation = a*Depth + b fitting
│   ├── geometry.py             # Pythagorean / line-of-sight checks
│   ├── export.py               # writes dsm.tif, heightmap16.png, metadata.json
│   ├── evaluate.py             # RMSE, MAE, correlation vs reference
│   ├── requirements.txt
│   └── notebooks/              # experiments
│
├── backend/                    # Backend
│   ├── main.py                 # FastAPI app and routes
│   ├── jobs.py                 # job ids, status tracking
│   └── requirements.txt
│
├── frontend/                   # Frontend
│   ├── index.html / src/
│   └── ...
│
├── unity/                      # Unity project (3D)
│   ├── Assets/
│   ├── Packages/
│   └── ProjectSettings/
│
├── data/
│   ├── samples/                # small test images + reference CSVs (committed)
│   ├── uploads/                # runtime uploads (git-ignored)
│   └── reference/              # SRTM / DEM / GCP files
│
├── outputs/                    # per-job results (git-ignored)
│   └── <job_id>/
│
└── docs/                       # diagrams, poster, report
```

---

## 7. Setup (Linux)

```bash
# clone
git clone <repo-url>
cd project-root

# ML environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
pip install -r backend/requirements.txt

# system library needed by rasterio on some distros
sudo apt install gdal-bin libgdal-dev
```

**Run the ML module alone (Siddu):**
```bash
python -m ml.pipeline --input data/samples/test1.jpg --output outputs/test1
```

**Run the backend:**
```bash
uvicorn backend.main:app --reload --port 8000
```

**Frontend:** open `frontend/index.html` or run its dev server (add the command here once decided).
**Unity:** open the `unity/` folder in Unity Hub (use the same Unity version on every machine, write it here: `Unity ____`).

> Note: Unity and Frontend teammates can start without waiting for ML. See Section 9.

---

## 8. Git workflow

1. **Never push directly to `main`.** `main` must always run.
2. Each person works on their own branch: `ml/…`, `backend/…`, `frontend/…`, `unity/…`
   Example: `git checkout -b ml/calibration`
3. Commit small and often, with clear messages (`ml: add linear calibration`).
4. Before opening a PR: `git pull origin main` and fix conflicts on your side.
5. Open a Pull Request into `main`. At least one other teammate reviews it.
6. **Stay in your folder.** If you need a change in someone else's folder, ask them or mention it in the PR.
7. **Unity:** commit `.meta` files, and do **not** commit `Library/`, `Temp/`, `Logs/`, `obj/` (see `.gitignore` below). Avoid two people editing the same scene at once; use prefabs.
8. Large files (models, big images, builds) go on shared drive, **not** Git.

`.gitignore` (minimum):
```
.venv/
__pycache__/
data/uploads/
outputs/
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

- **Siddu (ML)** first delivers a **sample output folder** at `data/samples/sample_output/` containing `texture.png`, `heightmap16.png`, `dsm.tif`, `metadata.json` (even if the values are rough). Real accuracy comes later.
- **Unity** builds the terrain from `sample_output/` directly, no backend required at first.
- **Backend** writes the API and, until ML is ready, a dummy `run_pipeline` that just copies `sample_output/` into `outputs/<job_id>/`.
- **Frontend** talks to the backend API; it works against the dummy responses.
- When the real ML is ready, swap the dummy for the real `run_pipeline`. Nothing else should change **if everyone followed Section 5**.

---

## 10. Milestones and integration plan

| Phase | Goal | Done when |
|---|---|---|
| 1. Agree | Freeze contracts in Section 5, create repo, assign owners | Everyone can clone and run "hello world" |
| 2. Standalone | Each module works alone with sample data | ML makes a depth map; Unity shows the sample terrain; backend serves sample files; frontend uploads and previews |
| 3. Connect | Backend calls real ML; Unity fetches from backend | Upload → 3D terrain end to end, with rough heights |
| 4. Calibrate and validate | Reference matching, metric calibration, RMSE/MAE/correlation | Metrics shown in frontend |
| 5. Polish | Click-to-read height, slope tool, view modes, UI, stability, standalone Unity build | Demo-ready, README and docs complete |

**Weekly rhythm:** a short sync (what's done, what's blocked, any contract changes), then merge to `main`.

---

## 11. Evaluation (what we are judged on)

- **DSM accuracy (50%):** RMSE, MAE, correlation against LiDAR/reference data, tested across urban, sparse, hilly, and forested scenes. ML owns `ml/evaluate.py`; frontend displays the numbers.
- **Visualization (50%):** projection accuracy, visual fidelity, flythrough navigation, UI intuitiveness, stability, and a working standalone build. Unity and Frontend own this.

---

## 12. Module-specific notes

**ML:** Keep functions small and testable. The model loads once, not per request. Resize large images to a fixed working size and record it in `metadata.json`.

**Backend:** Run ML in a background task so uploads don't hang. Always return clear errors (`failed` + message).

**Frontend:** Show the job status while waiting. Display `metadata.json` values (mode, min/max elevation, metrics) clearly. Provide a button to open the 3D view.

**Unity:** Read `metadata.json` first, then build terrain from `heightmap16.png`, apply `texture.png`. Required features: first-person flight, click a point to read metric height, slope between two points, toggle view modes. Make a standalone Linux/Windows build at the end.

---

## 13. Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| Unity terrain looks flat | Heightmap not rescaled using `min_elevation` / `max_elevation` from metadata |
| Texture and terrain misaligned | Width/height differ between `texture.png` and `heightmap16.png`; both must match metadata |
| rasterio install fails | Install GDAL system packages (Section 7) |
| Backend can't find outputs | Check that `output_dir` is `outputs/<job_id>/` and paths are relative to project root |
| Merge conflict in Unity scene | Don't edit the same scene together; use prefabs; re-pull before editing |

---

## 14. Changelog

_Add a line for every change to contracts, structure, or setup._

| Date | Who | Change |
|---|---|---|
| 2026-10-17 | Siddu | Initial README created |
| 2026-10-25 | Siddu | Sections 4 and 5 rewritten: workflow now has two parallel paths (ML objects + DEM terrain); new object data contract (GeoJSON), terrain outputs and output files; `dsm.tif` removed from the contract |

---

## References

1. Hu, M., et al. (2024). Metric3D v2: Zero-shot metric depth and surface normal estimation. *IEEE TPAMI*.
2. Xu, Z., et al. (2025). Dual branch multiscale stereo matching for satellite images. *IEEE JSTARS*, 18, 949–964.
3. Chen, Z., et al. (2024). Surface depth estimation from multiview stereo satellite images. *IEEE JSTARS*, 17, 17837–17845.
4. Chen, S., et al. (2023). HTC-DC Net: Monocular height estimation from remote sensing images. *IEEE TGRS*, 61, 1–18.