import React, { useState, useEffect, useRef } from "react";
import { getFileUrl } from "../lib/api";

export default function TerrainElevationViewer({ jobId, metadata }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [raw16Data, setRaw16Data] = useState(null);
  const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 });
  const [colorRamp, setColorRamp] = useState("hypsometric");
  const [cursorPos, setCursorPos] = useState(null);
  const [pinnedPoint, setPinnedPoint] = useState(null);

  const terrain = metadata?.terrain || {};
  const minElev = typeof terrain.min_elevation_m === "number" ? terrain.min_elevation_m : 0.0;
  const maxElev = typeof terrain.max_elevation_m === "number" ? terrain.max_elevation_m : 100.0;
  const elevSpan = maxElev - minElev;
  const meanElev = (minElev + maxElev) / 2;

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadHeightmap = async () => {
      try {
        const url = getFileUrl(jobId, "heightmap16.png");
        const res = await fetch(url);
        if (!res.ok) throw new Error("Could not load heightmap16.png");

        const buffer = await res.arrayBuffer();
        const fastPng = await import("fast-png");
        const decoded = fastPng.decode(buffer);

        if (!isMounted) return;

        setGridDimensions({ width: decoded.width, height: decoded.height });
        setRaw16Data(decoded.data);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || "Failed to load elevation matrix");
        setLoading(false);
      }
    };

    loadHeightmap();

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  const applyColorRamp = (norm) => {
    if (colorRamp === "grayscale") {
      const v = Math.round(norm * 255);
      return [v, v, v];
    }

    if (colorRamp === "viridis") {
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

    // Default: Topographic hypsometric tint (green -> yellow -> brown -> snow)
    if (norm < 0.3) {
      const t = norm / 0.3;
      return [Math.round(46 + t * 40), Math.round(117 + t * 65), Math.round(89 - t * 20)];
    } else if (norm < 0.6) {
      const t = (norm - 0.3) / 0.3;
      return [Math.round(86 + t * 130), Math.round(182 - t * 30), Math.round(69 - t * 30)];
    } else if (norm < 0.85) {
      const t = (norm - 0.6) / 0.25;
      return [Math.round(216 - t * 45), Math.round(152 - t * 60), Math.round(39 + t * 50)];
    } else {
      const t = (norm - 0.85) / 0.15;
      return [Math.round(171 + t * 75), Math.round(92 + t * 155), Math.round(89 + t * 160)];
    }
  };

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
      const norm = p16 / 65535.0;
      const [r, g, b] = applyColorRamp(norm);

      const offset = i * 4;
      buf[offset] = r;
      buf[offset + 1] = g;
      buf[offset + 2] = b;
      buf[offset + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [raw16Data, gridDimensions, colorRamp]);

  const computeElevation = (clientX, clientY) => {
    if (!raw16Data || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = gridDimensions.width / rect.width;
    const scaleY = gridDimensions.height / rect.height;

    const px = Math.floor((clientX - rect.left) * scaleX);
    const py = Math.floor((clientY - rect.top) * scaleY);

    if (px < 0 || px >= gridDimensions.width || py < 0 || py >= gridDimensions.height) {
      return null;
    }

    const idx = py * gridDimensions.width + px;
    const rawVal = raw16Data[idx];
    const norm = rawVal / 65535.0;
    const elevationM = minElev + norm * elevSpan;

    return { px, py, elevationM };
  };

  const active = pinnedPoint || cursorPos;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-subtle flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            Terrain Elevation (DEM)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            16-bit bare-ground Digital Terrain Model
          </p>
        </div>

        <select
          value={colorRamp}
          onChange={(e) => setColorRamp(e.target.value)}
          className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 focus:outline-none"
        >
          <option value="hypsometric">Topographic</option>
          <option value="viridis">Viridis</option>
          <option value="grayscale">Grayscale</option>
        </select>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 min-h-[400px] max-h-[520px] bg-slate-50 border border-slate-200 rounded-xl mt-4 overflow-hidden flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-10">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-medium">Decoding elevation grid...</span>
          </div>
        )}

        {error && (
          <div className="text-center p-6 text-slate-500 text-xs">
            <p className="font-medium text-slate-700">Elevation unavailable</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onMouseMove={(e) => setCursorPos(computeElevation(e.clientX, e.clientY))}
          onMouseLeave={() => setCursorPos(null)}
          onClick={(e) => {
            const data = computeElevation(e.clientX, e.clientY);
            if (data) setPinnedPoint(data);
          }}
          className="max-h-[460px] w-auto object-contain rounded cursor-crosshair"
        />

        {/* Live Elevation Readout Pill */}
        {active && (
          <div className="absolute bottom-3 left-3 z-20 bg-white/95 border border-slate-200/90 shadow-sm rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 flex items-center space-x-3">
            <span>
              Ground: <strong className="text-slate-900">{active.elevationM.toFixed(1)} m</strong>
            </span>
            <span className="text-slate-400">
              ({active.px}, {active.py})
            </span>
            {pinnedPoint && (
              <button
                onClick={() => setPinnedPoint(null)}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline font-sans"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Minimal Scale Legend */}
        <div className="absolute top-3 right-3 z-20 bg-white/90 border border-slate-200/80 px-2.5 py-1 rounded text-[10px] font-mono text-slate-600 shadow-sm flex items-center space-x-2">
          <span>{minElev.toFixed(0)}m</span>
          <div className="w-16 h-2 rounded bg-gradient-to-r from-emerald-600 via-amber-400 to-rose-400" />
          <span>{maxElev.toFixed(0)}m</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-mono">
        <span>Range: {minElev.toFixed(1)} m – {maxElev.toFixed(1)} m</span>
        <span>Mean: {meanElev.toFixed(1)} m</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-400 italic">
        DEM represents bare ground elevation; does not include structures or trees.
      </div>
    </div>
  );
}
