import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  Compass, 
  Copy, 
  Check, 
  RotateCw,
  Layers,
  Satellite,
  Mountain,
  MapPin
} from "lucide-react";
import { getJobStatus, getJobResult } from "../lib/api";

export default function ProcessingTracker({ jobId, onReset }) {
  const [jobStatus, setJobStatus] = useState("queued"); // 'queued' | 'running' | 'done' | 'failed'
  const [errorMessage, setErrorMessage] = useState(null);
  const [resultMetadata, setResultMetadata] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    let pollTimeout;

    const checkStatus = async () => {
      try {
        const data = await getJobStatus(jobId);
        if (!isMounted) return;

        setJobStatus(data.status);
        setPollCount((prev) => prev + 1);

        if (data.status === "failed") {
          setErrorMessage(data.error || "An unknown error occurred during pipeline processing.");
          return;
        }

        if (data.status === "done") {
          try {
            const meta = await getJobResult(jobId);
            if (isMounted) setResultMetadata(meta);
          } catch (e) {
            console.error("Could not fetch metadata upon completion", e);
          }
          return;
        }

        // Still queued or running; poll again
        pollTimeout = setTimeout(checkStatus, 1800);
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || "Failed to reach backend status endpoint.");
        pollTimeout = setTimeout(checkStatus, 3000);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [jobId]);

  const copyJobId = () => {
    navigator.clipboard.writeText(jobId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Pipeline stages mapped to actual backend state
  const stages = [
    {
      id: "upload",
      title: "Image Uploaded",
      desc: "GeoTIFF ingested, bounding box extracted & CRS registered",
      isComplete: true,
      isActive: false,
    },
    {
      id: "path_a",
      title: "Object Prediction (Part A)",
      desc: "Detecting building footprints, trees, and relative heights",
      isComplete: jobStatus === "done",
      isActive: jobStatus === "running",
    },
    {
      id: "path_b",
      title: "Terrain Data Fetching & Alignment (Part B)",
      desc: "GEDTM30 bare-ground DEM retrieved & resampled to match grid",
      isComplete: jobStatus === "done",
      isActive: jobStatus === "running",
    },
    {
      id: "combine",
      title: "Spatial Combination & Elevation Fusion",
      desc: "Top Elevation = Ground Elevation + Object Height Above Ground",
      isComplete: jobStatus === "done",
      isActive: jobStatus === "running",
    },
    {
      id: "done",
      title: "Processing Completed",
      desc: "Terrain DEM, GeoJSON, heightmaps and metadata generated",
      isComplete: jobStatus === "done",
      isActive: false,
    },
  ];

  return (
    <div className="bg-geo-card border border-geo-border rounded-xl p-6 sm:p-8 shadow-2xl relative">
      {/* Header with Job ID badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-geo-border/60 gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-geo-cyan">
            Active Processing Pipeline
          </span>
          <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2 mt-0.5">
            <span>Job Monitor:</span>
            <span className="font-mono text-cyan-300 font-normal">{jobId}</span>
          </h3>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={copyJobId}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-geo-surface border border-geo-border text-xs font-mono text-slate-300 hover:text-white hover:border-geo-border-light transition-all"
            title="Copy Job ID to clipboard"
          >
            {copiedId ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy ID</span>
              </>
            )}
          </button>

          {/* Status Badge */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border ${
              jobStatus === "done"
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : jobStatus === "failed"
                ? "bg-rose-950/60 border-rose-500/50 text-rose-300"
                : "bg-cyan-950/60 border-cyan-500/50 text-cyan-300"
            }`}
          >
            {jobStatus === "running" && (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-geo-cyan" />
            )}
            {jobStatus === "queued" && (
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            )}
            {jobStatus === "done" && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            {jobStatus === "failed" && (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="uppercase">{jobStatus}</span>
          </div>
        </div>
      </div>

      {/* Actual Backend State Stages */}
      <div className="py-6 space-y-4">
        {stages.map((stage, idx) => {
          let indicatorBg = "bg-slate-800 border-slate-700 text-slate-500";
          if (stage.isComplete) {
            indicatorBg = "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
          } else if (stage.isActive) {
            indicatorBg = "bg-cyan-500/20 border-cyan-400 text-cyan-300 animate-pulse";
          }

          return (
            <div
              key={stage.id}
              className={`flex items-start space-x-4 p-3.5 rounded-lg border transition-all ${
                stage.isActive
                  ? "bg-cyan-950/20 border-cyan-500/30 shadow-geo-glow"
                  : stage.isComplete
                  ? "bg-geo-surface/30 border-geo-border/40"
                  : "bg-geo-surface/10 border-geo-border/20 opacity-60"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 ${indicatorBg}`}
              >
                {stage.isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : stage.isActive ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                ) : (
                  idx + 1
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-200">
                    {stage.title}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {stage.isComplete ? "Done" : stage.isActive ? "Processing..." : "Pending"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{stage.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Failure State Notice */}
      {jobStatus === "failed" && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-200 text-xs space-y-2 mt-2">
          <div className="flex items-center space-x-2 font-semibold text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>Pipeline Execution Failed</span>
          </div>
          <p className="font-mono text-[11px] bg-rose-950/80 p-2.5 rounded border border-rose-900/60 overflow-x-auto">
            {errorMessage || "Check backend console logs for details."}
          </p>
          <div className="pt-2">
            <button
              onClick={onReset}
              className="px-4 py-2 rounded bg-rose-900/40 border border-rose-700 hover:bg-rose-900/60 text-xs font-medium text-rose-100 transition-all"
            >
              Start New Upload
            </button>
          </div>
        </div>
      )}

      {/* Completion CTA */}
      {jobStatus === "done" && (
        <div className="mt-6 pt-6 border-t border-geo-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-300">
            <span className="text-emerald-400 font-semibold">Ready: </span>
            Terrain DEM aligned, object geometries detected, and 3D scene built.
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={onReset}
              className="px-4 py-2.5 rounded-lg border border-geo-border text-xs font-mono text-slate-300 hover:bg-geo-surface transition-all"
            >
              New Job
            </button>

            <Link
              href={`/dashboard?job=${jobId}`}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 text-xs font-bold font-mono tracking-wide flex items-center justify-center space-x-2 shadow-geo-glow transition-all"
            >
              <span>OPEN RESULTS DASHBOARD</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
