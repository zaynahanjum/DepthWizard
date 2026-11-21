import React from "react";
import { Download, FileText, Map, Image, Layers } from "lucide-react";
import { getFileUrl } from "../lib/api";

export default function DownloadSection({ jobId }) {
  if (!jobId) return null;

  const downloadFiles = [
    {
      name: "terrain_dem.tif",
      label: "Terrain DEM",
      format: "GeoTIFF",
      description: "Resampled bare-ground elevation raster matching image bounds.",
      icon: Map,
    },
    {
      name: "objects.geojson",
      label: "Detected Objects",
      format: "GeoJSON",
      description: "Vector polygons, points, and estimated heights.",
      icon: FileText,
    },
    {
      name: "metadata.json",
      label: "Pipeline Metadata",
      format: "JSON",
      description: "CRS, bounding extent, elevation extremes, and calibration stats.",
      icon: Layers,
    },
    {
      name: "objects_scene.json",
      label: "3D Scene Geometry",
      format: "JSON",
      description: "Objects in Cartesian metric frame for 3D visualization.",
      icon: Layers,
    },
    {
      name: "heightmap16.png",
      label: "16-Bit Heightmap",
      format: "PNG",
      description: "Lossless elevation heightmap for GPU mesh displacement.",
      icon: Image,
    },
    {
      name: "texture.png",
      label: "Orthomosaic Texture",
      format: "PNG",
      description: "Aligned RGB satellite texture for 3D surface draping.",
      icon: Image,
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">
            Data Exports
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Download generated rasters, vectors, and scene data.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          Job {jobId}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {downloadFiles.map((file) => {
          const Icon = file.icon;
          const url = getFileUrl(jobId, file.name);

          return (
            <div
              key={file.name}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-mono font-medium text-slate-900">
                      {file.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                    {file.format}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-800">
                  {file.label}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {file.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex justify-end">
                <a
                  href={url}
                  download={file.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 transition-colors inline-flex items-center space-x-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
