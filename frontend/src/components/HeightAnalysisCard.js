import React from "react";
import { ArrowRight, Mountain, Building2, TrendingUp } from "lucide-react";

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

  // Extract objects with both valid ground elevation and height above ground
  const validObjects = [];
  if (geojsonData?.features && Array.isArray(geojsonData.features)) {
    geojsonData.features.forEach((f) => {
      const props = f.properties || {};
      const id = props.id || "obj";
      const cls = props.class || "building";
      const height = typeof props.height_above_ground_m === "number" ? props.height_above_ground_m : null;
      const sceneInfo = sceneMap.get(id);
      const groundElev = sceneInfo ? sceneInfo.groundElevation : null;

      if (height !== null && groundElev !== null) {
        validObjects.push({
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">
            Elevation Calibration
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Decoupled calculation of bare ground elevation and extruded object heights.
          </p>
        </div>
        <div className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
          Top = Ground + Height
        </div>
      </div>

      {/* 3-Step Formula Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Mountain className="w-4 h-4 text-slate-700" />
            <span>1. Ground Elevation</span>
          </div>
          <div className="text-sm font-semibold text-slate-900">
            Digital Terrain Model (DTM)
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Bare-ground elevation without structures.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Building2 className="w-4 h-4 text-slate-700" />
            <span>2. Height Above Ground</span>
          </div>
          <div className="text-sm font-semibold text-slate-900">
            AI Depth Estimation
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Extrusion height of structure from its base.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-900 bg-slate-900 text-white">
          <div className="flex items-center space-x-2 text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>3. Absolute Top Elevation</span>
          </div>
          <div className="text-sm font-semibold text-white">
            Calculated Summit
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Ground elevation plus object height.
          </p>
        </div>
      </div>

      {/* Sampled Breakdown */}
      {validObjects.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">
            Calibrated Sample Objects
          </h4>
          <div className="space-y-2 font-mono text-xs">
            {validObjects.slice(0, 5).map((obj) => (
              <div
                key={obj.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/70 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-900">{obj.id}</span>
                  <span className="text-[11px] text-slate-500 capitalize">({obj.class})</span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-600">{obj.groundElevation.toFixed(1)} m ground</span>
                  <span className="text-slate-400">+</span>
                  <span className="text-slate-800 font-medium">{obj.heightAboveGround.toFixed(1)} m height</span>
                  <span className="text-slate-400">=</span>
                  <span className="font-semibold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                    {obj.topElevation.toFixed(1)} m top
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
