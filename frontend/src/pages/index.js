import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { 
  Compass, 
  Layers, 
  Satellite, 
  Mountain, 
  Box, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  History, 
  ExternalLink,
  Info
} from "lucide-react";
import UploadDropzone from "../components/UploadDropzone";
import ProcessingTracker from "../components/ProcessingTracker";
import { uploadImagery, listRecentJobs } from "../lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [activeJobId, setActiveJobId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);

  // Load any existing jobs from backend
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

  const handleUpload = async (formData, metadataInfo) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const data = await uploadImagery(formData);
      setActiveJobId(data.job_id);
    } catch (err) {
      console.error("Upload failed", err);
      setUploadError(err.message || "Failed to upload imagery to backend pipeline.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetJob = () => {
    setActiveJobId(null);
    setUploadError(null);
  };

  return (
    <div className="relative">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-cyan-950/20 via-transparent to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Hero Section */}
      <section className="pt-10 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-xs font-mono text-cyan-300 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Academic Research Project • CSE Department</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Calibrating AI Depth Models with{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
              Real-World Geographic Constraints
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
            DepthWizard transforms a single georeferenced satellite/aerial RGB image into a high-fidelity, geodetically calibrated 3D terrain environment with verifiable real-world elevation.
          </p>
        </div>

        {/* Dual-Path Architecture Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {/* Path A */}
          <div className="p-4 rounded-xl bg-geo-card border border-geo-border shadow-md flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-geo-cyan shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold uppercase text-geo-cyan">
                  Part A • ML Elevation Estimation
                </span>
                <span className="text-[10px] font-mono text-slate-400">Siddu</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                AI object detection and height estimation identifies building footprints, trees, and roads, estimating heights above local ground level exported as <code className="text-slate-200">objects.geojson</code>.
              </p>
            </div>
          </div>

          {/* Path B */}
          <div className="p-4 rounded-xl bg-geo-card border border-geo-border shadow-md flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold uppercase text-teal-400">
                  Part B • Terrain Processing
                </span>
                <span className="text-[10px] font-mono text-slate-400">Jenisha</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Reads image coverage, retrieves OpenTopography GEDTM30 Digital Terrain Model, and resamples it to match the exact CRS, dimensions, and pixel grid as <code className="text-slate-200">terrain_dem.tif</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Core Formula Reference Box */}
        <div className="mt-4 p-3.5 rounded-lg bg-geo-surface/60 border border-geo-border flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-300 gap-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-geo-cyan shrink-0" />
            <span>
              <strong>Rigorous Formula:</strong> Top Elevation = Ground Elevation (DEM) + Object Height Above Ground (ML)
            </span>
          </div>
          <span className="text-slate-400 text-[11px] shrink-0">
            Bare-ground elevation never confused with object height
          </span>
        </div>
      </section>

      {/* Main Upload / Job Processing Section */}
      <section className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Upload / Monitor Area */}
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
              <div className="mt-4 p-4 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-mono">
                {uploadError}
              </div>
            )}
          </div>

          {/* Sidebar: Pipeline Specifications & Recent Jobs */}
          <div className="lg:col-span-4 space-y-6">
            {/* Input Requirements Checklist */}
            <div className="bg-geo-card border border-geo-border rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold mb-3 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Input GeoTIFF Specifications</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-300 font-mono">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Must be a georeferenced raster (<code className="text-slate-100">.tif / .tiff</code>)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Contains standard RGB color channels</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Embedded CRS metadata (UTM projected or geographic)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Automatic OpenTopography GEDTM30 fetching</span>
                </li>
              </ul>
            </div>

            {/* Recent Completed Jobs (Discovered on Server) */}
            <div className="bg-geo-card border border-geo-border rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center space-x-2">
                  <History className="w-4 h-4 text-geo-cyan" />
                  <span>Discovered Server Jobs</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {recentJobs.length} available
                </span>
              </div>

              {recentJobs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                  No previous jobs found on backend. Upload an image to start!
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {recentJobs.map((j) => (
                    <div
                      key={j.job_id}
                      className="p-2.5 rounded-lg bg-geo-surface/50 border border-geo-border hover:border-geo-cyan/50 transition-all flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <span className="font-semibold text-slate-200 block truncate max-w-[130px]">
                          {j.job_id}
                        </span>
                        <span className="text-[10px] text-emerald-400 uppercase">
                          {j.status}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/dashboard?job=${j.job_id}`}
                          className="px-2.5 py-1 rounded bg-geo-card border border-geo-border hover:border-geo-cyan text-geo-cyan text-[11px] flex items-center space-x-1"
                        >
                          <span>Dashboard</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Demo Access Card */}
            <div className="bg-gradient-to-br from-cyan-950/40 to-teal-950/20 border border-cyan-800/40 rounded-xl p-5">
              <div className="flex items-center space-x-2 text-cyan-300 text-xs font-bold font-mono uppercase mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Interactive 3D Demo Mode</span>
              </div>
              <p className="text-xs text-slate-300">
                Explore the Three.js 3D flythrough terrain engine with sample synthetic or real DEM test data.
              </p>
              <div className="mt-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold text-geo-cyan hover:underline"
                >
                  <span>Open Generic Dashboard View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
