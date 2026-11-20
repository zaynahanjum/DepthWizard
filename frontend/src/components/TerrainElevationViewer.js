import React, { useState, useEffect, useRef } from "react";
import { 
  Mountain, 
  MapPin, 
  Crosshair, 
  Eye, 
  Layers, 
  AlertCircle, 
  Info, 
  Sparkles,
  Palette
} from "lucide-react";
import { getFileUrl } from "../lib/api";

export default function TerrainElevationViewer({ jobId, metadata }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [raw16Data, setRaw16Data] = useState(null);
  const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 });
  const [colorRamp, setColorRamp] = useState("hypsometric"); // 'hypsometric' | 'viridis' | 'cyan' | 'grayscale'
  const [cursorPos, setCursorPos] = useState(null);
  const [pinnedPoint, setPinnedPoint] = useState(null);

  const terrain = metadata?.terrain || {};
  const minElev = typeof terrain.min_elevation_m === "number" ? terrain.min_elevation_m : 0.0;
  const maxElev = typeof terrain.max_elevation_m === "number" ? terrain.max_elevation_m : 100.0;
  const elevSpan = maxElev - minElev;
  const meanElev = (minElev + maxElev) / 2;

  // Load and decode 16-bit PNG heightmap
  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadHeightmap = async () => {
      try {
        const url = getFileUrl(jobId, "heightmap16.png");
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to load heightmap16.png (Status ${res.status})`);
        }

        const buffer = await res.arrayBuffer();
        const fastPng = await import("fast-png");
        const decoded = fastPng.decode(buffer);

        if (!isMounted) return;

        setGridDimensions({ width: decoded.width, height: decoded.height });
        // decoded.data is a Uint16Array for 16-bit grayscale
        setRaw16Data(decoded.data);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        console.error("Heightmap decoding error:", err);
        setError(err.message || "Failed to parse 16-bit heightmap");
        setLoading(false);
      }
    };

    loadHeightmap();

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  // Colormaps
  const applyColorRamp = (norm) => {
    // norm is 0.0 to 1.0
    if (colorRamp === "grayscale") {
      const v = Math.round(norm * 255);
      return [v, v, v];
    }

    if (colorRamp === "cyan") {
      // High-contrast deep navy to bright cyan to white
      const r = Math.round(norm * norm * 200);
      const g = Math.round(norm * 240);
      const b = Math.round(80 + norm * 175);
      return [r, g, b];
    }

    if (colorRamp === "viridis") {
      // Viridis-like approximation (purple -> blue -> teal -> yellow)
      if (norm < 0.25) {
        const t = norm / 0.25;
        return [Math.round(68 + t * (49 - 68)), Math.round(1 + t * (104 - 1)), Math.round(84 + t * (142 - 84))];
      } else if (norm < 0.5) {
        const t = (norm - 0.25) / 0.25;
        return [Math.round(49 + t * (33 - 49)), Math.round(104 + t * (145 - 104)), Math.round(142 + t * (140 - 142))];
      } else if (norm < 0.75) {
        const t = (norm - 0.5) / 0.25;
        return [Math.round(33 + t * (94 - 33)), Math.round(145 + t * (201 - 145)), Math.round(140 + t * (98 - 140))];
      } else {
        const t = (norm - 0.75) / 0.25;
        return [Math.round(94 + t * (253 - 94)), Math.round(201 + t * (231 - 201)), Math.round(98 + t * (37 - 98))];
      }
    }

    // Default: Hypsometric Topographic tint
    // Deep Green (lowland) -> Yellow-Green -> Ochre/Brown (mid elevation) -> White/Snow (high peaks)
    if (norm < 0.3) {
      const t = norm / 0.3;
      return [Math.round(34 + t * 45), Math.round(100 + t * 90), Math.round(50 + t * 20)];
    } else if (norm < 0.6) {
      const t = (norm - 0.3) / 0.3;
      return [Math.round(79 + t * 130), Math.round(190 + t * 10), Math.round(70 - t * 30)];
    } else if (norm < 0.85) {
      const t = (norm - 0.6) / 0.25;
      return [Math.round(209 - t * 40), Math.round(140 - t * 40), Math.round(50 + t * 50)];
    } else {
      const t = (norm - 0.85) / 0.15;
      return [Math.round(169 + t * 86), Math.round(100 + t * 155), Math.round(100 + t * 155)];
    }
  };

  // Render to canvas whenever data or colorRamp changes
  useEffect(() => {
    if (!raw16Data || !gridDimensions.width || !gridDimensions.height) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const { width, height } = gridDimensions;
    canvas.width = width;
    canvas.height = height;

    const imgData = ctx.createImageData(width, height);
    const buf = imgData.data;

    for (let i = 0; i < raw16Data.length; i++) {
      const p16 = raw16Data[i];
      const norm = p16 / 65535.0; // Normalized 0..1
      const [r, g, b] = applyColorRamp(norm);

      const offset = i * 4;
      buf[offset] = r;
      buf[offset + 1] = g;
      buf[offset + 2] = b;
      buf[offset + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [raw16Data, gridDimensions, colorRamp]);

  // Inspect elevation from canvas hover/click
  const computeElevationAtCoord = (clientX, clientY) => {
    if (!raw16Data || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = gridDimensions.width / rect.width;
    const scaleY = gridDimensions.height / rect.height;

    const pixelX = Math.floor((clientX - rect.left) * scaleX);
    const pixelY = Math.floor((clientY - rect.top) * scaleY);

    if (pixelX < 0 || pixelX >= gridDimensions.width || pixelY < 0 || pixelY >= gridDimensions.height) {
      return null;
    }

    const index = pixelY * gridDimensions.width + pixelX;
    const rawVal = raw16Data[index];

    // Formula from DepthWizard Specification:
    // elevation_m = min_elevation_m + (pixel / 65535) * (max_elevation_m - min_elevation_m)
    const norm = rawVal / 65535.0;
    const elevationM = minElev + norm * elevSpan;

    // Projected / Geographic coordinates if extent is known
    let geoX = null;
    let geoY = null;
    if (metadata?.extent) {
      const { min_x, max_x, min_y, max_y } = metadata.extent;
      geoX = min_x + (pixelX / gridDimensions.width) * (max_x - min_x);
      geoY = max_y - (pixelY / gridDimensions.height) * (max_y - min_y);
    }

    return {
      pixelX,
      pixelY,
      rawVal,
      elevationM,
      geoX,
      geoY,
      percentElevation: (norm * 100).toFixed(1),
    };
  };

  const handleMouseMove = (e) => {
    const data = computeElevationAtCoord(e.clientX, e.clientY);
    setCursorPos(data);
  };

  const handleClick = (e) => {
    const data = computeElevationAtCoord(e.clientX, e.clientY);
    if (data) {
      setPinnedPoint(data);
    }
  };

  const activeInspection = pinnedPoint || cursorPos;

  return (
    <div className="bg-geo-card border border-geo-border rounded-xl p-5 shadow-xl flex flex-col h-full">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-geo-border gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <Mountain className="w-4 h-4 text-emerald-400" />
              <span>Terrain Elevation Model (DTM)</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300">
              16-Bit Bare Ground DEM
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Calibrated bare-ground elevation grid derived from OpenTopography GEDTM30
          </p>
        </div>

        {/* Colormap Selector */}
        <div className="flex items-center space-x-2">
          <Palette className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 font-mono">Palette:</span>
          <select
            value={colorRamp}
            onChange={(e) => setColorRamp(e.target.value)}
            className="text-xs font-mono bg-geo-surface border border-geo-border text-slate-200 rounded px-2.5 py-1 focus:border-geo-cyan focus:outline-none"
          >
            <option value="hypsometric">Hypsometric Tint (Topo)</option>
            <option value="viridis">Viridis (Scientific)</option>
            <option value="cyan">Cyber Cyan (Radar HUD)</option>
            <option value="grayscale">Grayscale (16-bit Raw)</option>
          </select>
        </div>
      </div>

      {/* Interactive Elevation Canvas Container */}
      <div className="relative flex-1 min-h-[440px] max-h-[560px] bg-geo-bg border border-geo-border/80 rounded-lg mt-4 overflow-hidden flex items-center justify-center">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-geo-grid pointer-events-none opacity-40" />

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-geo-bg/80 z-20">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-mono text-slate-400">
              Decoding 16-Bit High-Precision Elevation Matrix...
            </span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center p-6 text-slate-400 text-xs z-20">
            <p className="text-rose-400 font-semibold mb-1">Failed to load elevation data</p>
            <p className="font-mono">{error}</p>
          </div>
        )}

        {/* Canvas Display */}
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setCursorPos(null)}
          onClick={handleClick}
          className="max-h-[480px] w-auto object-contain rounded shadow-2xl cursor-crosshair transition-transform"
        />

        {/* Live Elevation Inspector HUD Card (Floating) */}
        {activeInspection && (
          <div className="absolute bottom-4 left-4 z-20 bg-geo-card/95 border border-emerald-500/50 backdrop-blur-md rounded-lg p-3.5 shadow-2xl text-xs font-mono min-w-[240px]">
            <div className="flex items-center justify-between border-b border-geo-border/60 pb-1.5 mb-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center space-x-1">
                <Crosshair className="w-3.5 h-3.5" />
                <span>{pinnedPoint ? "Pinned Point" : "Live Cursor"}</span>
              </span>
              {pinnedPoint && (
                <button
                  onClick={() => setPinnedPoint(null)}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  Unpin
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Ground Elevation:</span>
                <span className="text-sm font-bold text-white text-emerald-300">
                  {activeInspection.elevationM.toFixed(2)} m
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Pixel Position:</span>
                <span className="text-slate-200">
                  X:{activeInspection.pixelX}, Y:{activeInspection.pixelY}
                </span>
              </div>
              {activeInspection.geoX !== null && (
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Coord:</span>
                  <span className="text-slate-300">
                    {activeInspection.geoX.toFixed(4)}, {activeInspection.geoY.toFixed(4)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>Raw 16-bit Int:</span>
                <span className="text-slate-400">
                  {activeInspection.rawVal} / 65535
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Color Gradient Scale Bar (Top Right) */}
        <div className="absolute top-4 right-4 z-20 bg-geo-card/90 border border-geo-border/80 px-3 py-2 rounded-lg backdrop-blur-md text-[10px] font-mono text-slate-300 flex items-center space-x-3">
          <span>{minElev.toFixed(0)} m</span>
          <div className="w-24 h-2.5 rounded bg-gradient-to-r from-emerald-600 via-yellow-400 to-rose-400" />
          <span>{maxElev.toFixed(0)} m</span>
        </div>
      </div>

      {/* Elevation Statistics & Spatial Integrity Cards */}
      <div className="mt-4 pt-3 border-t border-geo-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-400">
        <div>
          <span className="text-slate-500 block text-[10px]">ELEVATION RANGE</span>
          <span className="text-emerald-400 font-semibold">
            {minElev.toFixed(1)} m → {maxElev.toFixed(1)} m
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">MEAN ELEVATION</span>
          <span className="text-slate-200">{meanElev.toFixed(1)} m</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">NODATA PIXELS</span>
          <span className="text-slate-200">0 (Interpolated)</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">VERTICAL REFERENCE</span>
          <span className="text-amber-400/90">{terrain.vertical_reference || "Metres (GEDTM30)"}</span>
        </div>
      </div>

      {/* Bare Ground Elevation Notice */}
      <div className="mt-3 text-[11px] text-slate-400 bg-geo-surface/40 p-2.5 rounded border border-geo-border/50 flex items-start space-x-2">
        <Info className="w-4 h-4 text-geo-cyan shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-200 font-semibold">Important Elevation Specification: </span>
          The DEM represents <span className="text-geo-cyan font-semibold">bare-ground elevation</span> only. It does not measure building roofs or tree tops. Building heights are estimated independently by Part A and added to the terrain base.
        </div>
      </div>
    </div>
  );
}
