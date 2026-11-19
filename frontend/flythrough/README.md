# DepthWizard 3D Flythrough (Three.js)

Browser-based 3D terrain flythrough for the DepthWizard output contract (root README, section 5.3).
It reads `metadata.json`, `heightmap16.png`, `texture.png` and, optionally, `objects_scene.json`.

## Run

```bash
cd frontend/flythrough
npm install
npm run dev          # http://localhost:5173  (generates a synthetic demo terrain on first run)
npm run build        # static site in dist/
```

## Data sources (URL query parameters)

| URL | Loads |
|---|---|
| `/` or `?base=./demo/` | synthetic demo terrain (`npm run demo` regenerates it) |
| `?base=./data/` | any folder under `public/` containing the contract files |
| `?job=<job_id>` | `http://localhost:8000/files/<job_id>/...` (backend `GET /files/{job_id}/{filename}`) |
| `?job=<id>&api=http://host:port` | same, with a different backend |
| `&exag=6` / `&maxgrid=512` | optional: vertical exaggeration / max mesh resolution (default 1024 x 1024) |

The backend must allow CORS from the dev server origin when using `?job=`.

## Using the real DEM (`terrain_dem.tif`)

`outputs/terrain_dem.tif` (10980 x 10980 on the sample) is too large for a browser, so convert it once:

```bash
pip install rasterio opencv-python numpy        # scipy optional (nicer NoData fill)
python frontend/flythrough/tools/export_viewer.py \
    --terrain outputs/terrain_dem.tif --satellite data/samples/satellite.tif \
    --out frontend/flythrough/public/data
```

Then open `http://localhost:5173/?base=./data/`. This writes `heightmap16.png` (16-bit, downsampled with NoData excluded),
`texture.png` (percentile-stretched if the image is not 8-bit) and `metadata.json` with the real `extent`/CRS.
Elevation is decoded exactly as in the README: `elevation_m = min + pixel/65535 * (max - min)`.

## Controls

| | |
|---|---|
| **Flythrough** | Terrain-following spline loop. Pause/restart, speed and flight-height sliders. Any movement key hands over control. |
| **Free fly** | `W A S D` move, `Q`/`E` or `Space` down/up, `Shift` fast, drag (or arrow keys) to look. Cannot go below the terrain. |
| **Orbit** | Drag to orbit, right-drag to pan, scroll to zoom. |
| **Measure** | Click terrain for true elevation; click a second point for height difference, horizontal and slope distance, slope angle. |
| **Colour by** | Satellite texture, elevation ramp, slope ramp (green < 10 deg ... red > 40 deg). |

Vertical exaggeration only affects how the scene looks. All readouts (elevation, slope, AGL) are converted back to true metres.

## Layout

```
src/loader.js    fetches metadata + decodes the 16-bit PNG (fast-png)
src/terrain.js   mesh from heightmap, normals, colour modes, heightAt(), ray-march picking
src/flight.js    flythrough path, free-fly, orbit controls
src/objects.js   buildings / trees / roads from objects_scene.json
src/main.js      scene, UI wiring, measure tool
scripts/make-demo.mjs   synthetic terrain generator
tools/export_viewer.py  GeoTIFF -> viewer files
```

## Notes / limits

- `objects_scene.json` is the format proposed in README 5.3 (local frame, x east, z north from the SW corner). The raw WGS84 `objects.geojson` is not read directly.
- Coordinates: world x = east, z = south (image rows), y = up; 1 unit = 1 m.
- Mesh resolution is capped at 1024 x 1024 vertices (about 2M triangles); lower `maxgrid` on weak GPUs.
- The exporter adds an optional `texture: {width, height}` block to `metadata.json`; the viewer ignores it (it maps by UV), so a texture larger than the heightmap is fine.
