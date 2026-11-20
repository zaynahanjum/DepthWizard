import React, { useState, useRef } from "react";
import { Upload, FileCode, CheckCircle2, AlertTriangle, Info, Satellite, Mountain, Sparkles, X } from "lucide-react";

export default function UploadDropzone({ onUploadSuccess, isUploading }) {
  const [satelliteFile, setSatelliteFile] = useState(null);
  const [demFile, setDemFile] = useState(null);
  const [useDummyObjects, setUseDummyObjects] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const satelliteInputRef = useRef(null);
  const demInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateAndSetSatelliteFile = (file) => {
    setErrorMessage(null);
    if (!file) return;

    const ext = file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
    if (ext !== "tif" && ext !== "tiff") {
      setErrorMessage("Please select a valid GeoTIFF file (.tif or .tiff). Other formats lack spatial georeferencing tags.");
      return;
    }
    setSatelliteFile(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetSatelliteFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!satelliteFile) {
      setErrorMessage("Please select a georeferenced satellite GeoTIFF image to process.");
      return;
    }

    const formData = new FormData();
    formData.append("image", satelliteFile);
    if (demFile) {
      formData.append("dem", demFile);
    }
    formData.append("use_dummy_objects", useDummyObjects ? "true" : "false");

    onUploadSuccess(formData, {
      satelliteName: satelliteFile.name,
      satelliteSize: formatFileSize(satelliteFile.size),
      hasDem: !!demFile,
    });
  };

  return (
    <div className="bg-geo-card border border-geo-border rounded-xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
      {/* Decorative Corner Accents */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-geo-cyan" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-geo-cyan" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-geo-cyan" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-geo-cyan" />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main GeoTIFF Satellite Drag-and-Drop Dropzone */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Satellite className="w-4 h-4 text-geo-cyan" />
              <span>Georeferenced RGB Satellite Image <span className="text-geo-cyan">*</span></span>
            </span>
            <span className="text-xs font-mono text-slate-400">Supported: .tif, .tiff</span>
          </label>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => satelliteInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-geo-cyan bg-cyan-950/20"
                : satelliteFile
                ? "border-emerald-500/50 bg-emerald-950/10"
                : "border-geo-border hover:border-geo-border-light hover:bg-geo-surface/60"
            }`}
          >
            <input
              ref={satelliteInputRef}
              type="file"
              accept=".tif,.tiff"
              onChange={(e) => validateAndSetSatelliteFile(e.target.files[0])}
              className="hidden"
            />

            {satelliteFile ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-100 font-mono">
                  {satelliteFile.name}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Size: {formatFileSize(satelliteFile.size)} • Type: GeoTIFF Raster
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSatelliteFile(null);
                  }}
                  className="mt-3 text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove and select another</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-geo-surface border border-geo-border flex items-center justify-center text-geo-cyan mb-3 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-200">
                  Drag and drop your satellite GeoTIFF here, or{" "}
                  <span className="text-geo-cyan underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Must be georeferenced (GeoTIFF) with RGB color bands. The coordinate system and bounds will be automatically extracted.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Optional Digital Terrain Model (DTM) Section */}
        <div className="border border-geo-border/60 bg-geo-surface/40 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Mountain className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-slate-200">
                  Bare-Ground Elevation Source (DTM / DEM)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  DepthWizard automatically queries and downloads GEDTM30 (30m Bare-Ground Elevation) from OpenTopography using the image bounds. Alternatively, you can supply your own custom high-res DEM GeoTIFF.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => demInputRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded bg-geo-card border border-geo-border hover:border-geo-cyan text-slate-300 hover:text-white transition-all shrink-0 ml-4 font-mono"
            >
              {demFile ? "Change DEM" : "+ Custom DEM"}
            </button>
            <input
              ref={demInputRef}
              type="file"
              accept=".tif,.tiff"
              onChange={(e) => setDemFile(e.target.files[0] || null)}
              className="hidden"
            />
          </div>

          {demFile && (
            <div className="mt-3 flex items-center justify-between text-xs font-mono bg-teal-950/30 border border-teal-800/40 rounded px-3 py-1.5 text-teal-300">
              <span className="truncate">Attached: {demFile.name} ({formatFileSize(demFile.size)})</span>
              <button
                type="button"
                onClick={() => setDemFile(null)}
                className="text-rose-400 hover:text-rose-300 ml-2"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* ML Prediction Setting & Transparency */}
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
                  Part A: AI Object Detection & Height Estimation Status
                </h4>
                <p className="text-xs text-amber-300/80 mt-1">
                  Model training and real prediction weights (Siddu) are currently being finalized. The pipeline uses the testing stub (<code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-200">ml/predict.py</code>) to produce mock buildings, trees, and roads calibrated to the image&apos;s real geographic footprint.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-amber-900/30 flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDummyObjects}
                onChange={(e) => setUseDummyObjects(e.target.checked)}
                className="w-4 h-4 rounded bg-geo-card border-geo-border text-cyan-500 focus:ring-0"
              />
              <span className="text-xs font-medium text-slate-300">
                Generate test objects via prediction stub
              </span>
            </label>
            <span className="text-[11px] font-mono text-amber-400/90">
              Contract Verified (GeoJSON WGS84)
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center space-x-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={!satelliteFile || isUploading}
            className={`w-full py-3.5 px-6 rounded-lg font-medium text-sm transition-all flex items-center justify-center space-x-2 ${
              !satelliteFile || isUploading
                ? "bg-geo-surface text-slate-500 cursor-not-allowed border border-geo-border"
                : "bg-gradient-to-r from-cyan-600 via-cyan-500 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold shadow-geo-glow"
            }`}
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Uploading Imagery & Spawning Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Process Satellite Imagery in DepthWizard</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
