import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, FileSpreadsheet } from "lucide-react";
import UploadDropzone from "../components/UploadDropzone";
import ProcessingTracker from "../components/ProcessingTracker";
import { uploadImagery, listRecentJobs } from "../lib/api";

export default function UploadPage() {
  const [activeJobId, setActiveJobId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);

  // Load existing runs from server
  useEffect(() => {
    let mounted = true;
    const loadJobs = async () => {
      const jobs = await listRecentJobs();
      if (mounted) setRecentJobs(jobs);
    };
    loadJobs();
    return () => {
      mounted = false;
    };
  }, [activeJobId]);

  const handleUpload = async (formData) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const data = await uploadImagery(formData);
      setActiveJobId(data.job_id);
    } catch (err) {
      console.error("Upload failed", err);
      setUploadError(err.message || "Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetJob = () => {
    setActiveJobId(null);
    setUploadError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-12">
      {/* Clean Header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">
          Satellite Elevation & 3D Terrain
        </h1>
        <p className="mt-3.5 text-slate-500 text-sm sm:text-base leading-relaxed">
          Upload a georeferenced satellite image to extract bare-ground elevation models, detect structures, and estimate metric heights.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload / Tracker Section */}
        <div className="lg:col-span-8">
          {activeJobId ? (
            <ProcessingTracker jobId={activeJobId} onReset={handleResetJob} />
          ) : (
            <UploadDropzone
              onUploadSuccess={handleUpload}
              isUploading={isUploading}
            />
          )}

          {uploadError && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {uploadError}
            </div>
          )}
        </div>

        {/* Minimal Sidebar: Specifications & Available Runs */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Technical Specs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Image Requirements
            </h3>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Format: Georeferenced GeoTIFF (<code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded">.tif / .tiff</code>)</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Bands: 3-channel RGB imagery</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Spatial Reference: WGS84 or UTM projected</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Terrain DEM: Auto-retrieved from OpenTopography or user-provided</span>
              </li>
            </ul>
          </div>

          {/* Previous Runs / Server Datasets */}
          {recentJobs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Recent Datasets
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {recentJobs.length} total
                </span>
              </div>

              <div className="space-y-2">
                {recentJobs.map((j) => (
                  <Link
                    key={j.job_id}
                    href={`/dashboard?job=${j.job_id}`}
                    className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 transition-all text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-800 group-hover:text-slate-900 truncate max-w-[150px]">
                        {j.job_id}
                      </div>
                      <div className="text-[11px] text-slate-400 uppercase mt-0.5 font-mono">
                        {j.status}
                      </div>
                    </div>

                    <div className="text-slate-400 group-hover:text-slate-700 flex items-center space-x-1">
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Demo Shortcut */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
            <h4 className="text-sm font-semibold tracking-tight">Explore Sample Dataset</h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Open the interactive dashboard with pre-processed terrain and 3D flythrough data.
            </p>
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-medium transition-colors"
              >
                <span>Launch Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
