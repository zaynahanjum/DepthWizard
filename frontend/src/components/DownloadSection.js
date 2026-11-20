import React from "react";
import { Download, FileCode, HardDrive, Map, Image, Layers, Sparkles } from "lucide-react";
import { getFileUrl } from "../lib/api";

export default function DownloadSection({ jobId }) {
  if (!jobId) return null;

  const downloadFiles = [
    {
      name: "terrain_dem.tif",
      label: "Aligned Terrain DEM (GeoTIFF)",
      description: "Bilinear resampled, georeferenced bare-ground terrain elevation raster matching image bounds and resolution.",
      format: "GeoTIFF (.tif)",
      downstream: "GIS, QGIS, ArcGIS, Python GDAL",
      icon: Map,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/30",
    },
    {
      name: "objects.geojson",
      label: "Object Detections (GeoJSON)",
      description: "Standard WGS84 GeoJSON FeatureCollection with detected footprints, point objects, and estimated heights.",
      format: "GeoJSON (.geojson)",
      downstream: "Web GIS, Leaflet, Mapbox, Pipeline",
      icon: FileCode,
      color: "text-cyan-400",
      borderColor: "border-cyan-500/30",
    },
    {
      name: "metadata.json",
      label: "Pipeline Metadata (JSON)",
      description: "Job execution parameters, CRS, bounding extent, elevation extremes, and calibration statistics.",
      format: "JSON (.json)",
      downstream: "Validation, Unity Importer, Frontend",
      icon: HardDrive,
      color: "text-sky-400",
      borderColor: "border-sky-500/30",
    },
    {
      name: "objects_scene.json",
      label: "Unity 3D Scene Geometry",
      description: "Objects converted into local metric Cartesian frame (x east, z north, base_y ground elevation).",
      format: "Scene JSON (.json)",
      downstream: "Unity Engine 3D Scene Importer",
      icon: Layers,
      color: "text-teal-400",
      borderColor: "border-teal-500/30",
    },
    {
      name: "heightmap16.png",
      label: "16-Bit Terrain Heightmap",
      description: "Lossless 16-bit single-channel elevation heightmap for real-time 3D GPU vertex displacement.",
      format: "16-bit PNG (.png)",
      downstream: "Three.js Flythrough, Unity Terrain",
      icon: Image,
      color: "text-amber-400",
      borderColor: "border-amber-500/30",
    },
    {
      name: "texture.png",
      label: "Orthomosaic Surface Texture",
      description: "Aligned 8-bit RGB texture cropped to match terrain extent for draped 3D surface visualization.",
      format: "PNG Image (.png)",
      downstream: "Three.js Flythrough, Unity Material",
      icon: Image,
      color: "text-purple-400",
      borderColor: "border-purple-500/30",
    },
  ];

  return (
    <div className="bg-geo-card border border-geo-border rounded-xl p-5 shadow-xl">
      <div className="pb-4 border-b border-geo-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
            <Download className="w-4 h-4 text-geo-cyan" />
            <span>Generated Export Artifacts & Data Downloads</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Download georeferenced output files directly from the backend via <code className="text-slate-300">GET /files/{jobId}/[filename]</code>
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          Job: <strong className="text-cyan-300">{jobId}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {downloadFiles.map((file) => {
          const Icon = file.icon;
          const url = getFileUrl(jobId, file.name);

          return (
            <div
              key={file.name}
              className={`p-4 rounded-xl bg-geo-surface/40 border ${file.borderColor} hover:bg-geo-surface/70 transition-all flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 ${file.color}`} />
                    <span className="text-xs font-mono font-bold text-slate-100">
                      {file.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-geo-card border border-geo-border text-slate-300">
                    {file.format}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-slate-200 mt-1">
                  {file.label}
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  {file.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-geo-border/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">
                  Target: {file.downstream}
                </span>

                <a
                  href={url}
                  download={file.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-geo-card hover:bg-cyan-950 border border-geo-border hover:border-geo-cyan text-xs font-mono text-cyan-300 hover:text-white transition-all flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
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
