# Calibrating AI Depth Models with Real-World Geographic Constraints

> Single-view satellite/aerial RGB image → metric elevation map (DSM) → interactive 3D flythrough.

**Team:** B G R Siddu, Khatija Kaneez, Zaynah Anjum, Jenisha Dsouza
**Guide:** Dr. Joyline Dsa
**Dept:** Computer Science and Engineering, Sahyadri College of Engineering and Management

>  **This README is a living document.** Anyone on the team can edit it. If you change a folder, a file format, an API route, or a setup step, update this file in the same commit. Add a line to the [Changelog](#14-changelog) at the bottom.

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
| **Backend** | _(name)_ | `backend/` | Receives uploads, runs the ML module, stores and serves results |
| **Frontend** | _(name)_ | `frontend/` | Upload page, result preview, height validation, launches 3D view |
| **Unity (3D)** | _(name)_ | `unity/` | Builds the textured 3D terrain and flythrough, with height/slope tools |

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

## 4. System workflow (the most important section)

```
                ┌───────────────┐
                │   FRONTEND    │  1. User uploads image (+ optional reference points)
                └──────┬────────┘
                       │ POST /upload
                       ▼
                ┌───────────────┐
                │    BACKEND    │  2. Saves file, creates job_id, calls ML module
                └──────┬────────┘
                       │ run_pipeline(input, job_dir)
                       ▼
        ┌──────────────────────────────┐
        │              ML              │
        │ a. Preprocess image          │
        │ b. Monocular depth (relative)│
        │ c. Reference matching        │
        │ d. Metric calibration        │
        │ e. Geometric constraint check│
        │ f. Export DSM + heightmap    │
        └──────────────┬───────────────┘
                       │ writes files to outputs/<job_id>/
                       ▼
                ┌───────────────┐
                │    BACKEND    │  3. Marks job "done", serves files via URL
                └───┬───────┬───┘
                    │       │
          GET /result       │ GET /files/<job_id>/...
                    ▼       ▼
          ┌───────────┐   ┌───────────┐
          │ FRONTEND  │   │   UNITY   │  4. Downloads texture + heightmap + metadata,
          │ preview + │   │ 3D mesh + │     builds terrain, enables flythrough,
          │ validation│   │ flythrough│     click-to-read height, slope tool
          └───────────┘   └───────────┘
```

### Step by step

1. **Upload:** The user picks an image in the frontend. Optionally they add reference points or an SRTM file.
2. **Job creation:** Backend saves the file in `data/uploads/`, generates a `job_id`, and starts the ML pipeline.
3. **Depth estimation (ML):** The pre-trained model produces a relative depth map.
4. **Reference matching (ML):** If the image is georeferenced, the footprint is matched against the reference database (landmarks with GPS and known elevation) or SRTM.
5. **Calibration (ML):** Fit `Elevation = a × Depth + b`. If non-georeferenced, skip and output an rDSM.
6. **Geometric constraints (ML):** Use line-of-sight and horizontal-distance geometry to sanity-check and refine heights.
7. **Export (ML):** Write the output files listed in Section 5 into `outputs/<job_id>/`.
8. **Serve (Backend):** Status becomes `done`; the files are available over HTTP.
9. **Preview and validate (Frontend):** Show the depth/DSM preview, RMSE/MAE/correlation if reference data was given.
10. **3D view (Unity):** Fetch `texture.png`, `heightmap16.png`, `metadata.json`; build the terrain; let the user fly around, click for height, measure slope.

---

## 5. Interface contracts (do not change without telling the team)

### 5.1 ML → Backend (Python function)

```python
# ml/pipeline.py
def run_pipeline(input_path: str, output_dir: str, reference_path: str | None = None) -> dict:
    """
    input_path     : PNG / JPG / TIF image
    output_dir     : folder where all outputs are written (outputs/<job_id>/)
    reference_path : optional CSV of reference points or an SRTM/DEM GeoTIFF
    returns        : the metadata dict (same content as metadata.json)
    """
```

Backend only calls this one function. ML internals can change freely.

### 5.2 Output files (ML → everyone)

Every job produces a folder `outputs/<job_id>/`:

| File | Description | Used by |
|---|---|---|
| `texture.png` | Original RGB image (resized if needed) | Unity, Frontend |
| `depth_relative.png` | Colourised relative depth, for preview | Frontend |
| `dsm.tif` | Final DSM (GeoTIFF; rDSM if no georeference) | Validation, GIS users |
| `heightmap16.png` | DSM scaled to 16-bit grayscale (0 = min, 65535 = max) | **Unity** |
| `metadata.json` | See below | Everyone |

`metadata.json`:

```json
{
  "job_id": "abc123",
  "mode": "absolute",          // "absolute" (DSM) or "relative" (rDSM)
  "width": 1024,
  "height": 1024,
  "min_elevation": 12.4,       // metres (or relative units if mode = relative)
  "max_elevation": 88.9,
  "pixel_size_m": 0.5,         // null if unknown
  "crs": "EPSG:32643",         // null if not georeferenced
  "calibration": { "a": 0.83, "b": 11.2 },
  "metrics": { "rmse": 2.1, "mae": 1.6, "correlation": 0.94 }   // null if no reference
}
```

**Unity converts a heightmap pixel back to metres with:**
`height = min_elevation + (pixel / 65535) × (max_elevation − min_elevation)`

### 5.3 Backend API

| Method | Route | Purpose |
|---|---|---|
| POST | `/upload` | Upload image (+ optional reference file). Returns `{ "job_id": "..." }` |
| GET | `/status/{job_id}` | Returns `queued`, `running`, `done`, or `failed` |
| GET | `/result/{job_id}` | Returns the `metadata.json` content |
| GET | `/files/{job_id}/{filename}` | Download any output file |

Backend runs on `http://localhost:8000` during development.

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
| _YYYY-MM-DD_ | Siddu | Initial README created |

---

## References

1. Hu, M., et al. (2024). Metric3D v2: Zero-shot metric depth and surface normal estimation. *IEEE TPAMI*.
2. Xu, Z., et al. (2025). Dual branch multiscale stereo matching for satellite images. *IEEE JSTARS*, 18, 949–964.
3. Chen, Z., et al. (2024). Surface depth estimation from multiview stereo satellite images. *IEEE JSTARS*, 17, 17837–17845.
4. Chen, S., et al. (2023). HTC-DC Net: Monocular height estimation from remote sensing images. *IEEE TGRS*, 61, 1–18.