# DepthWizard IEEE Paper – Overleaf & Figure Guide

## How to Upload to Overleaf

1. Go to [overleaf.com](https://www.overleaf.com) → **New Project → Upload Project**
2. Upload the file `DepthWizard_IEEE_Paper.tex` (found at `docs/DepthWizard_IEEE_Paper.tex`)
3. The document class `IEEEtran` is pre-installed on Overleaf — no extra package installation needed.
4. Set the compiler to **pdfLaTeX** (default on Overleaf).
5. Click **Recompile** — the PDF should build immediately with placeholder boxes where figures go.

---

## Figure Placeholders — What to Put Where

The paper has four figure slots. Each has a `\framebox` placeholder with a comment block above it telling you exactly what to insert. When your screenshot or diagram is ready:

1. Create a folder called `figures/` inside your Overleaf project.
2. Upload your image file into that folder.
3. Find the matching figure in the `.tex` file and **uncomment the `\includegraphics` line** while **deleting the `\framebox` block**.

| Figure | File Name to Upload | Recommended Content |
|--------|--------------------|--------------------|
| Fig. 1 | `figures/architecture.png` | System block diagram: Path A (AI/ML) + Path B (Terrain) → Fusion → Export → Viewer. Use draw.io or PowerPoint. |
| Fig. 2 | `figures/viewer_modes.png` | Three side-by-side screenshots from the Three.js viewer — (a) Satellite texture, (b) Elevation heatmap, (c) Slope gradient. |
| Fig. 3 | `figures/terrain_comparison.png` | (a) Sentinel-2 RGB thumbnail and (b) GEDTM30 pseudo-coloured elevation raster for the same area. |
| Fig. 4 | `figures/scene_objects.png` | 3D scene with buildings and trees rendered on the terrain, HUD measurement panel visible. |

> **Tip:** For highest quality in IEEE PDF, export as **PDF or EPS** rather than PNG. If using PNG, minimum 300 DPI for print, 150 DPI is acceptable for Overleaf preview.

---

## Rubric Coverage Check

| Rubric Section (/4) | Coverage in Paper |
|--------------------|--------------------|
| **Abstract, Introduction & Problem Statement** | Full Abstract + Section I with 5 enumerated contributions and clear problem framing. |
| **Literature Review & Research Gap** | Section II reviews HTC-DC Net (base paper), MiDaS, Depth Anything V2, Metric3D v2, AdaBins, and satellite stereo work; ends with explicit 3-point research gap. |
| **Proposed Methodology & Implementation** | Section III: 7 subsections with equations, Algorithm 1, and all system components described mathematically. |
| **Results, Discussion & Conclusion** | Section IV: terrain validation table, API table, metric evaluation framework, Discussion with limitation analysis. Section V: Conclusion + 5 future directions. |
| **Paper Formatting, Citations & References** | IEEE two-column conference format, IEEEtran class, 11 genuine cited references with DOIs, BibTeX-ready. |

---

## Reference Summary (for your records)

| # | Reference | Used for |
|---|-----------|---------|
| [1] | Chen et al. 2023, HTC-DC Net, IEEE TGRS | **Base paper** — cited 5 times |
| [2] | Yang et al. 2024, Depth Anything V2, NeurIPS | Proposed backbone model |
| [3] | Hu et al. 2024, Metric3D v2, IEEE TPAMI | Zero-shot metric alternative |
| [4] | Ranftl et al. 2022, MiDaS, IEEE TPAMI | Foundation of affine-invariant depth |
| [5] | Ranftl et al. 2021, DPT, ICCV | ViT for dense prediction |
| [6] | Bhat et al. 2021, AdaBins, CVPR | Adaptive bin method used in HTC-DC Net |
| [7] | Xu et al. 2025, Dual-branch stereo, IEEE JSTARS | Satellite stereo comparison |
| [8] | Chen et al. 2024, DC-SatMVS, IEEE JSTARS | Multi-view satellite depth baseline |
| [9] | Ho & Hengl 2025, GEDTM30, OpenTopography | Terrain data source citation |
| [10] | GDAL Contributors 2024 | Geospatial library |
| [11] | Cabello et al. 2024, Three.js | Visualisation engine |

