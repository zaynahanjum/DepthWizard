import React from "react";

export default function SummaryCards({ metadata, jobId, objectCount }) {
  if (!metadata) return null;

  const width = metadata.width || metadata.texture?.width || "—";
  const height = metadata.height || metadata.texture?.height || "—";
  const crs = metadata.crs || "—";
  const pixelSize = metadata.pixel_size_m ? `${metadata.pixel_size_m.toFixed(1)} m/px` : "—";

  const terrain = metadata.terrain || {};
  const minElev = typeof terrain.min_elevation_m === "number" ? terrain.min_elevation_m.toFixed(1) : "—";
  const maxElev = typeof terrain.max_elevation_m === "number" ? terrain.max_elevation_m.toFixed(1) : "—";

  const totalObjects = typeof objectCount === "number" ? objectCount : metadata.objects?.count ?? "—";

  const cards = [
    {
      label: "Job ID",
      value: jobId || metadata.job_id || "—",
      subtext: "FastAPI Pipeline",
      mono: true,
    },
    {
      label: "Grid Resolution",
      value: `${width} × ${height}`,
      subtext: pixelSize,
      mono: true,
    },
    {
      label: "Coordinate System",
      value: crs,
      subtext: "WGS84 / UTM",
      mono: true,
    },
    {
      label: "Min Elevation",
      value: minElev !== "—" ? `${minElev} m` : "—",
      subtext: "Bare-ground DEM",
      mono: true,
    },
    {
      label: "Max Elevation",
      value: maxElev !== "—" ? `${maxElev} m` : "—",
      subtext: "Bare-ground DEM",
      mono: true,
    },
    {
      label: "Detected Objects",
      value: totalObjects,
      subtext: "Part A Catalog",
      mono: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map((c, i) => (
        <div
          key={i}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-subtle flex flex-col justify-between"
        >
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            {c.label}
          </span>
          <div className="my-2">
            <span className={`text-xl font-semibold text-slate-900 tracking-tight truncate block ${c.mono ? "font-mono" : ""}`} title={String(c.value)}>
              {c.value}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono truncate">
            {c.subtext}
          </span>
        </div>
      ))}
    </div>
  );
}
