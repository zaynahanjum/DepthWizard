import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Copy, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { getJobStatus, getJobResult } from "../lib/api";

export default function ProcessingTracker({ jobId, onReset }) {
  const [jobStatus, setJobStatus] = useState("queued");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    let pollTimeout;

    const poll = async () => {
      try {
        const data = await getJobStatus(jobId);
        if (!isMounted) return;

        setJobStatus(data.status);

        if (data.status === "failed") {
          setError(data.error || "Processing failed.");
          return;
        }

        if (data.status === "done") {
          return;
        }

        pollTimeout = setTimeout(poll, 1500);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || "Unable to check status.");
        pollTimeout = setTimeout(poll, 2500);
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [jobId]);

  const copyJobId = () => {
    navigator.clipboard.writeText(jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { title: "Image ingestion & metadata extraction", done: true },
    { title: "Object detection & height estimation (Part A)", done: jobStatus === "done", active: jobStatus === "running" },
    { title: "GEDTM30 terrain retrieval & alignment (Part B)", done: jobStatus === "done", active: jobStatus === "running" },
    { title: "Spatial fusion & 3D scene export", done: jobStatus === "done", active: jobStatus === "running" },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div>
          <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Job Processing</span>
          <div className="flex items-center space-x-2 mt-1">
            <h3 className="text-base font-semibold text-slate-900 font-mono">{jobId}</h3>
            <button
              onClick={copyJobId}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              title="Copy ID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`text-xs font-medium px-3 py-1 rounded-full uppercase tracking-wider ${
            jobStatus === "done"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : jobStatus === "failed"
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          {jobStatus}
        </span>
      </div>

      {/* Steps List */}
      <div className="space-y-3.5 py-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center space-x-3 text-sm">
            {step.done ? (
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            ) : step.active ? (
              <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs shrink-0 font-medium">
                {i + 1}
              </div>
            )}
            <span className={step.done ? "text-slate-800" : step.active ? "text-blue-600 font-medium" : "text-slate-400"}>
              {step.title}
            </span>
          </div>
        ))}
      </div>

      {/* Error */}
      {jobStatus === "failed" && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-2">
          <div className="flex items-center space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Processing failed</span>
          </div>
          <p className="font-mono text-slate-700">{error}</p>
          <button
            onClick={onReset}
            className="mt-2 text-xs font-medium text-rose-700 underline"
          >
            Start over
          </button>
        </div>
      )}

      {/* Done CTA */}
      {jobStatus === "done" && (
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onReset}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Process another image
          </button>

          <Link
            href={`/dashboard?job=${jobId}`}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-medium transition-colors shadow-sm"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
