import React from "react";
import { 
  Layers, 
  MapPin, 
  Maximize2, 
  Mountain, 
  Box, 
  ShieldCheck, 
  Sparkles,
  TrendingUp,
  Compass
} from "lucide-react";

export default function SummaryCards({ metadata, jobId, objectCount }) {
  if (!metadata) return null;

  const width = metadata.width || metadata.texture?.width || "N/A";
  const height = metadata.height || metadata.texture?.height || "N/A";
  const crs = metadata.crs || "N/A";
  const pixelSize = metadata.pixel_size_m ? `${metadata.pixel_size_m.toFixed(2)} m/px` : "N/A";

  const terrain = metadata.terrain || {};
  const minElev = typeof terrain.min_elevation_m === "number" ? terrain.min_elevation_m.toFixed(1) : "N/A";
  const maxElev = typeof terrain.max_elevation_m === "number" ? terrain.max_elevation_m.toFixed(1) : "N/A";
  const elevSpan = (typeof terrain.min_elevation_m === "number" && typeof terrain.max_elevation_m === "number")
    ? (terrain.max_elevation_m - terrain.min_elevation_m).toFixed(1)
    : "N/A";
  
  const meanElev = (typeof terrain.min_elevation_m === "number" && typeof terrain.max_elevation_m === "number")
    ? ((terrain.min_elevation_m + terrain.max_elevation_m) / 2).toFixed(1)
    : "N/A";

  const totalObjects = typeof objectCount === "number" ? objectCount : metadata.objects?.count ?? "N/A";

  const cards = [
    {
      title: "Active Job ID",
      value: jobId || metadata.job_id || "N/A",
      subtext: "FastAPI Pipeline Instance",
      icon: ShieldCheck,
      color: "text-geo-cyan",
      borderColor: "border-cyan-500/30",
      mono: true,
    },
    {
      title: "Raster Grid Dimensions",
      value: `${width} × ${height}`,
      subtext: `Resolution: ${pixelSize}`,
      icon: Maximize2,
      color: "text-teal-400",
      borderColor: "border-teal-500/30",
      mono: true,
    },
    {
      title: "Coordinate System (CRS)",
      value: crs,
      subtext: metadata.input_georeferenced ? "Georeferenced (UTM / Projected)" : "Non-georeferenced",
      icon: Compass,
      color: "text-sky-400",
      borderColor: "border-sky-500/30",
      mono: true,
    },
    {
      title: "Terrain Min Elevation",
      value: minElev !== "N/A" ? `${minElev} m` : "N/A",
      subtext: `Datum: ${terrain.vertical_reference || "Metres"}`,
      icon: Mountain,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/30",
      mono: true,
    },
    {
      title: "Terrain Max Elevation",
      value: maxElev !== "N/A" ? `${maxElev} m` : "N/A",
      subtext: `Vertical Span: ${elevSpan} m`,
      icon: TrendingUp,
      color: "text-amber-400",
      borderColor: "border-amber-500/30",
      mono: true,
    },
    {
      title: "Detected Objects (Part A)",
      value: totalObjects,
      subtext: metadata.objects?.source === "dummy" || metadata.objects?.source?.includes("STUB")
        ? "Source: Testing Stub (ml/predict)"
        : "Source: ML Model Prediction",
      icon: Box,
      color: "text-cyan-300",
      borderColor: "border-cyan-500/30",
      mono: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className={`bg-geo-card border ${card.borderColor} rounded-xl p-4 shadow-lg hover:border-geo-cyan/50 hover:bg-geo-card-hover transition-all flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                {card.title}
              </span>
              <Icon className={`w-4 h-4 ${card.color}`} />
            </div>

            <div className="my-2">
              <span
                className={`text-lg font-bold text-slate-100 truncate block ${
                  card.mono ? "font-mono" : ""
                }`}
                title={String(card.value)}
              >
                {card.value}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 truncate">
              {card.subtext}
            </p>
          </div>
        );
      })}
    </div>
  );
}
