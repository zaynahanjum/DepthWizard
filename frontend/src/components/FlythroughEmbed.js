import React, { useState } from "react";
import { ExternalLink, Play, Compass } from "lucide-react";
import { FLYTHROUGH_BASE_URL, API_BASE_URL } from "../lib/api";

export default function FlythroughEmbed({ jobId }) {
  const [showEmbedded, setShowEmbedded] = useState(false);

  if (!jobId) return null;

  const flythroughUrl = `${FLYTHROUGH_BASE_URL}/?job=${jobId}&api=${API_BASE_URL}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">
              3D Terrain Flythrough
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              Three.js
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time elevation displacement, texture draping, and extruded building volumes.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowEmbedded(!showEmbedded)}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
          >
            {showEmbedded ? "Collapse View" : "Embed Preview"}
          </button>

          <a
            href={flythroughUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors inline-flex items-center space-x-1.5"
          >
            <span>Launch 3D</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {showEmbedded ? (
        <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video relative">
          <iframe
            src={flythroughUrl}
            title="DepthWizard 3D Flythrough"
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        </div>
      ) : (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 space-y-1">
            <div>• Free camera flight (WASD + Mouse) with terrain-following automated spline</div>
            <div>• Surface distance, slope profiling, and real-time metric elevation probe</div>
          </div>

          <a
            href={flythroughUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-4 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 transition-colors inline-flex items-center space-x-1.5 shadow-2xs"
          >
            <Play className="w-3.5 h-3.5 text-slate-700" />
            <span>Open 3D Viewer</span>
          </a>
        </div>
      )}
    </div>
  );
}
