import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, AlertCircle, RefreshCw, Plus } from "lucide-react";

import SummaryCards from "../components/SummaryCards";
import SatelliteViewer from "../components/SatelliteViewer";
import TerrainElevationViewer from "../components/TerrainElevationViewer";
import ObjectDetectionTable from "../components/ObjectDetectionTable";
import HeightAnalysisCard from "../components/HeightAnalysisCard";
import DownloadSection from "../components/DownloadSection";
import FlythroughEmbed from "../components/FlythroughEmbed";

import { 
  getJobResult, 
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
        const meta = await getJobResult(activeJobId);
        if (!isMounted) return;
        setMetadata(meta);

        try {
          const geojson = await fetchGeoJson(activeJobId, "objects.geojson");
          if (isMounted) setGeojsonData(geojson);
        } catch (e) {
          console.warn("Could not load objects.geojson:", e);
        }

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
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-700 flex items-center space-x-1 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Upload</span>
            </Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">Dashboard</span>
          </div>

          <div className="flex items-center space-x-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Elevation & Object Analysis
            </h1>
            {activeJobId && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200">
                {activeJobId}
              </span>
            )}
          </div>
        </div>

        {/* Job Switcher & New Upload Button */}
        <div className="flex items-center space-x-3">
          {recentJobs.length > 0 && (
            <div className="flex items-center space-x-2">
              <select
                value={activeJobId || ""}
                onChange={(e) => handleJobSelect(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-mono text-slate-700 rounded-lg px-3 py-1.5 focus:border-slate-400 focus:outline-none shadow-2xs"
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
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors inline-flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Run</span>
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-slate-800">
            Loading Elevation Assets...
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Retrieving GeoTIFF raster, DEM matrix, and detected objects.
          </p>
        </div>
      )}

      {/* Error or Empty State */}
      {!loading && (error || !activeJobId) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm space-y-4">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {error ? "Unable to Load Job Results" : "No Dataset Selected"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 font-mono">
              {error || "Upload a georeferenced satellite image to begin processing."}
            </p>
          </div>
          <div>
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors"
            >
              <span>Upload Image</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && metadata && activeJobId && (
        <>
          {/* Summary Metric Cards */}
          <section>
            <SummaryCards
              metadata={metadata}
              jobId={activeJobId}
              objectCount={geojsonData?.features?.length}
            />
          </section>

          {/* Viewers: Orthomosaic & Terrain Elevation */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="h-full">
              <SatelliteViewer
                jobId={activeJobId}
                metadata={metadata}
                geojsonData={geojsonData}
                selectedObject={selectedObject}
                onSelectObject={(obj) => setSelectedObject(obj)}
              />
            </div>

            <div className="h-full">
              <TerrainElevationViewer
                jobId={activeJobId}
                metadata={metadata}
              />
            </div>
          </section>

          {/* 3D Flythrough */}
          <section>
            <FlythroughEmbed jobId={activeJobId} />
          </section>

          {/* Object Catalog */}
          <section>
            <ObjectDetectionTable
              geojsonData={geojsonData}
              sceneData={sceneData}
              metadata={metadata}
              selectedObject={selectedObject}
              onSelectObject={(obj) => setSelectedObject(obj)}
            />
          </section>

          {/* Height Calibration Breakdown */}
          <section>
            <HeightAnalysisCard
              geojsonData={geojsonData}
              sceneData={sceneData}
              metadata={metadata}
            />
          </section>

          {/* Exports / Downloads */}
          <section>
            <DownloadSection jobId={activeJobId} />
          </section>
        </>
      )}
    </div>
  );
}
