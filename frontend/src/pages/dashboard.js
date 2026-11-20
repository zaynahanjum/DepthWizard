import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { 
  Compass, 
  Layers, 
  Satellite, 
  Mountain, 
  Box, 
  TrendingUp, 
  Download, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Info,
  Sparkles
} from "lucide-react";

import SummaryCards from "../components/SummaryCards";
import SatelliteViewer from "../components/SatelliteViewer";
import TerrainElevationViewer from "../components/TerrainElevationViewer";
import ObjectDetectionTable from "../components/ObjectDetectionTable";
import HeightAnalysisCard from "../components/HeightAnalysisCard";
import DownloadSection from "../components/DownloadSection";
import FlythroughEmbed from "../components/FlythroughEmbed";

import { 
  getJobResult, 
  getJobStatus, 
  fetchGeoJson, 
  fetchSceneJson, 
  listRecentJobs 
} from "../lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { job: jobQuery } = router.query;

  const [activeJobId, setActiveJobId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [geojsonData, setGeojsonData] = useState(null);
  const [sceneData, setSceneData] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);

  // Discover jobs on load
  useEffect(() => {
    let mounted = true;
    const fetchAvailableJobs = async () => {
      const jobs = await listRecentJobs();
      if (!mounted) return;
      setRecentJobs(jobs);

      if (!jobQuery && jobs.length > 0) {
        // Auto-select the first available job if no query param provided
        setActiveJobId(jobs[0].job_id);
      }
    };
    fetchAvailableJobs();
    return () => {
      mounted = false;
    };
  }, [jobQuery]);

  // Synchronize active job ID with URL parameter
  useEffect(() => {
    if (jobQuery) {
      setActiveJobId(jobQuery);
    }
  }, [jobQuery]);

  // Fetch results whenever activeJobId changes
  useEffect(() => {
    if (!activeJobId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadAllJobData = async () => {
      try {
        // 1. Fetch metadata.json from GET /result/{job_id}
        const meta = await getJobResult(activeJobId);
        if (!isMounted) return;
        setMetadata(meta);

        // 2. Fetch objects.geojson from GET /files/{job_id}/objects.geojson
        try {
          const geojson = await fetchGeoJson(activeJobId, "objects.geojson");
          if (isMounted) setGeojsonData(geojson);
        } catch (e) {
          console.warn("Could not load objects.geojson:", e);
        }

        // 3. Fetch objects_scene.json if available
        try {
          const scene = await fetchSceneJson(activeJobId);
          if (isMounted) setSceneData(scene);
        } catch (e) {
          console.warn("Could not load objects_scene.json:", e);
        }

        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        console.error("Dashboard data load error:", err);
        setError(err.message || `Failed to load results for job ${activeJobId}`);
        setLoading(false);
      }
    };

    loadAllJobData();

    return () => {
      isMounted = false;
    };
  }, [activeJobId]);

  const handleJobSelect = (jobId) => {
    setActiveJobId(jobId);
    router.push(`/dashboard?job=${jobId}`, undefined, { shallow: true });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
      {/* Top Header / Breadcrumbs & Job Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-geo-border gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mb-1">
            <Link href="/" className="hover:text-geo-cyan flex items-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Upload</span>
            </Link>
            <span>/</span>
            <span className="text-slate-200">Results Dashboard</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-3">
            <span>Geospatial Analysis Dashboard</span>
            {activeJobId && (
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-normal">
                Job: {activeJobId}
              </span>
            )}
          </h1>
        </div>

        {/* Job Selector Dropdown */}
        <div className="flex items-center space-x-3">
          {recentJobs.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                Select Job:
              </span>
              <select
                value={activeJobId || ""}
                onChange={(e) => handleJobSelect(e.target.value)}
                className="bg-geo-card border border-geo-border text-xs font-mono text-slate-200 rounded-lg px-3 py-2 focus:border-geo-cyan focus:outline-none"
              >
                {recentJobs.map((j) => (
                  <option key={j.job_id} value={j.job_id}>
                    {j.job_id} ({j.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-geo-surface hover:bg-slate-800 border border-geo-border text-xs font-mono text-slate-300 hover:text-white transition-all"
          >
            + Process New Image
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-geo-card border border-geo-border rounded-xl p-16 text-center shadow-xl">
          <div className="w-10 h-10 border-2 border-geo-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-200">
            Loading Geospatial Output Assets...
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Retrieving DEM raster, GeoJSON features, and calibrated elevation metadata.
          </p>
        </div>
      )}

      {/* Error / Empty State */}
      {!loading && (error || !activeJobId) && (
        <div className="bg-geo-card border border-geo-border rounded-xl p-12 text-center shadow-xl space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-200">
              {error ? "Failed to Load Job Results" : "No Job Selected"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 font-mono">
              {error || "Upload a georeferenced satellite image to generate your first elevation and 3D object dataset."}
            </p>
          </div>
          <div>
            <Link
              href="/"
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold text-xs font-mono shadow-geo-glow"
            >
              <span>Go to Image Upload</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main Dashboard Content (Displayed when metadata is loaded) */}
      {!loading && metadata && activeJobId && (
        <>
          {/* SECTION A: Overview Summary Cards */}
          <section>
            <SummaryCards
              metadata={metadata}
              jobId={activeJobId}
              objectCount={geojsonData?.features?.length}
            />
          </section>

          {/* SECTION B & C: Parallel Satellite Orthomosaic Viewer & Terrain Elevation DEM Viewer */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Satellite Image Viewer */}
            <div className="h-full">
              <SatelliteViewer
                jobId={activeJobId}
                metadata={metadata}
                geojsonData={geojsonData}
                selectedObject={selectedObject}
                onSelectObject={(obj) => setSelectedObject(obj)}
              />
            </div>

            {/* Terrain Elevation DEM Viewer */}
            <div className="h-full">
              <TerrainElevationViewer
                jobId={activeJobId}
                metadata={metadata}
              />
            </div>
          </section>

          {/* SECTION D: Object Detection & Geometry Catalog */}
          <section>
            <ObjectDetectionTable
              geojsonData={geojsonData}
              sceneData={sceneData}
              metadata={metadata}
              selectedObject={selectedObject}
              onSelectObject={(obj) => setSelectedObject(obj)}
            />
          </section>

          {/* SECTION E: Height Analysis Breakdown */}
          <section>
            <HeightAnalysisCard
              geojsonData={geojsonData}
              sceneData={sceneData}
              metadata={metadata}
            />
          </section>

          {/* SECTION F: 3D Flythrough Integration */}
          <section>
            <FlythroughEmbed jobId={activeJobId} />
          </section>

          {/* SECTION G: Downloads and Output Artifacts */}
          <section>
            <DownloadSection jobId={activeJobId} />
          </section>
        </>
      )}
    </div>
  );
}
