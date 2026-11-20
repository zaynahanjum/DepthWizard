import React, { useState, useRef } from "react";
import { Upload, Check, X, AlertCircle } from "lucide-react";

export default function UploadDropzone({ onUploadSuccess, isUploading }) {
  const [satelliteFile, setSatelliteFile] = useState(null);
  const [demFile, setDemFile] = useState(null);
  const [useDummyObjects, setUseDummyObjects] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);

  const satelliteInputRef = useRef(null);
  const demInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleFile = (file) => {
    setError(null);
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext !== "tif" && ext !== "tiff") {
      setError("Please upload a georeferenced GeoTIFF (.tif or .tiff).");
      return;
    }
    setSatelliteFile(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!satelliteFile) {
      setError("Please select a GeoTIFF image.");
      return;
    }

    const formData = new FormData();
    formData.append("image", satelliteFile);
    if (demFile) formData.append("dem", demFile);
    formData.append("use_dummy_objects", useDummyObjects ? "true" : "false");

    onUploadSuccess(formData, {
      satelliteName: satelliteFile.name,
      satelliteSize: formatFileSize(satelliteFile.size),
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Upload Dropzone */}
        <div>
          <div
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => satelliteInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-slate-900 bg-slate-50"
                : satelliteFile
                ? "border-emerald-500 bg-emerald-50/40"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
            }`}
          >
            <input
              ref={satelliteInputRef}
              type="file"
              accept=".tif,.tiff"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />

            {satelliteFile ? (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <p className="text-sm font-semibold text-slate-900">{satelliteFile.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatFileSize(satelliteFile.size)}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSatelliteFile(null);
                  }}
                  className="mt-3 text-xs text-slate-500 hover:text-rose-600 flex items-center space-x-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Choose a different file</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-800">
                  Drop your satellite GeoTIFF here, or <span className="text-blue-600 underline">browse</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Accepts georeferenced RGB .tif or .tiff
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Optional Custom DEM Attachment */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-600">
            {demFile ? (
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-900">{demFile.name}</span>
                <span className="text-slate-400">({formatFileSize(demFile.size)})</span>
                <button
                  type="button"
                  onClick={() => setDemFile(null)}
                  className="text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <span>DEM terrain is automatically retrieved via OpenTopography GEDTM30.</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => demInputRef.current?.click()}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
          >
            {demFile ? "Change DEM" : "+ Attach Custom DEM"}
          </button>
          <input
            ref={demInputRef}
            type="file"
            accept=".tif,.tiff"
            onChange={(e) => setDemFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>

        {/* Prediction Mode Note */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useDummyObjects}
              onChange={(e) => setUseDummyObjects(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-0"
            />
            <span>Use test object geometries (model in training)</span>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center space-x-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!satelliteFile || isUploading}
          className={`w-full py-3 px-5 rounded-xl text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
            !satelliteFile || isUploading
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-slate-900 hover:bg-black text-white shadow-sm"
          }`}
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <span>Run Processing Pipeline</span>
          )}
        </button>
      </form>
    </div>
  );
}
