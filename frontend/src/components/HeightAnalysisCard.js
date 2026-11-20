import React from "react";
import { 
  TrendingUp, 
  Layers, 
  HelpCircle, 
  AlertCircle, 
  ArrowUpRight, 
  CheckCircle2, 
  Mountain, 
  Building2 
} from "lucide-react";

export default function HeightAnalysisCard({ geojsonData, sceneData, metadata }) {
  const minElev = metadata?.terrain?.min_elevation_m ?? 0.0;

  // Build lookup
  const sceneMap = new Map();
  if (sceneData?.objects && Array.isArray(sceneData.objects)) {
    sceneData.objects.forEach((obj) => {
      if (obj.id) {
        sceneMap.set(obj.id, {
          groundElevation: minElev + (obj.base_y || 0),
          heightM: obj.height_m,
        });
      }
    });
  }

  // Extract objects that have both valid height and ground elevation
  const validHeightObjects = [];
  if (geojsonData?.features && Array.isArray(geojsonData.features)) {
    geojsonData.features.forEach((f) => {
      const props = f.properties || {};
      const id = props.id || "obj";
      const cls = props.class || "building";
      const height = typeof props.height_above_ground_m === "number" ? props.height_above_ground_m : null;
      const sceneInfo = sceneMap.get(id);
      const groundElev = sceneInfo ? sceneInfo.groundElevation : null;

      if (height !== null && groundElev !== null) {
        validHeightObjects.push({
          id,
          class: cls,
          groundElevation: groundElev,
          heightAboveGround: height,
          topElevation: groundElev + height,
        });
      }
    });
  }

  return (
    <div className="bg-geo-card border border-geo-border rounded-xl p-5 shadow-xl">
      {/* Title */}
      <div className="pb-4 border-b border-geo-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-geo-cyan" />
            <span>Height Calibration & Absolute Elevation Analysis</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Decoupled calculation of bare ground terrain elevation and extruded AI object heights
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-geo-surface border border-geo-border text-slate-300">
          Formula: Top = Ground + Height
        </span>
      </div>

      {/* Explanatory Tri-Quantity Concept Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
        <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold font-mono uppercase mb-1">
            <Mountain className="w-4 h-4" />
            <span>1. Bare-Ground Elevation</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Measured elevation of the natural ground surface without human-made structures or vegetation.
          </p>
          <div className="mt-3 text-[11px] font-mono text-emerald-300 bg-emerald-950/60 p-1.5 rounded border border-emerald-900">
            Source: Part B (GEDTM30 / DEM)
          </div>
        </div>

        <div className="p-4 rounded-lg bg-cyan-950/20 border border-cyan-800/40">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold font-mono uppercase mb-1">
            <Building2 className="w-4 h-4" />
            <span>2. Object Height Above Ground</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            How tall a structure or tree extends vertically above the local ground beneath its footprint.
          </p>
          <div className="mt-3 text-[11px] font-mono text-cyan-300 bg-cyan-950/60 p-1.5 rounded border border-cyan-900">
            Source: Part A (AI Depth / Height)
          </div>
        </div>

        <div className="p-4 rounded-lg bg-sky-950/20 border border-sky-800/40">
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold font-mono uppercase mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>3. Absolute Top Elevation</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            The combined absolute vertical elevation of the roof or highest vertex above datum.
          </p>
          <div className="mt-3 text-[11px] font-mono text-sky-300 bg-sky-950/60 p-1.5 rounded border border-sky-900">
            Derived: Ground + Object Height
          </div>
        </div>
      </div>

      {/* Visual Vertical Stack Comparison for Valid Objects */}
      <div>
        <h4 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider mb-3">
          Calculated Vertical Profiles (Sampled Objects)
        </h4>

        {validHeightObjects.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono py-4 text-center">
            No objects currently have both ground elevation and height above ground available.
          </p>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {validHeightObjects.map((obj) => (
              <div
                key={obj.id}
                className="bg-geo-surface/50 border border-geo-border p-3.5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <div>
                    <span className="font-bold text-slate-100">{obj.id}</span>
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Class: {obj.class}
                    </span>
                  </div>
                </div>

                {/* Formula Breakdown Segment */}
                <div className="flex items-center space-x-2 bg-geo-card p-2 rounded border border-geo-border text-xs">
                  <span className="text-emerald-400" title="Ground Elevation">
                    {obj.groundElevation.toFixed(1)} m
                  </span>
                  <span className="text-slate-500 font-sans">+</span>
                  <span className="text-cyan-400 font-semibold" title="Object Height Above Ground">
                    {obj.heightAboveGround.toFixed(1)} m
                  </span>
                  <span className="text-slate-500 font-sans">=</span>
                  <span className="text-white font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 text-cyan-200">
                    {obj.topElevation.toFixed(1)} m Top
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Strict Engineering Disclaimers */}
      <div className="mt-5 pt-4 border-t border-geo-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center space-x-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Strict rule applied: No top elevation computed when height or ground elevation is missing.</span>
        </div>
        <span className="font-mono text-slate-500">
          Units: Metres (Compatible Vertical Frames)
        </span>
      </div>
    </div>
  );
}
