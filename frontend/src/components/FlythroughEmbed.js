import React, { useState } from "react";
import { Compass, ExternalLink, Play, Eye, Maximize2, Sparkles, Navigation } from "lucide-react";
import { FLYTHROUGH_BASE_URL, API_BASE_URL } from "../lib/api";

export default function FlythroughEmbed({ jobId }) {
  const [showEmbedded, setShowEmbedded] = useState(false);

  if (!jobId) return null;

  const flythroughUrl = `${FLYTHROUGH_BASE_URL}/?job=${jobId}&api=${API_BASE_URL}`;

  return (
    <div className="bg-geo-card border border-geo-border rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-geo-border gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <Compass className="w-4 h-4 text-geo-cyan" />
              <span>Interactive 3D Terrain Flythrough</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300">
              Three.js Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time GPU mesh displacement, texture draping, and extruded 3D object rendering
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowEmbedded(!showEmbedded)}
            className="px-3 py-1.5 rounded-lg bg-geo-surface border border-geo-border hover:border-geo-border-light text-xs font-mono text-slate-300 hover:text-white transition-all flex items-center space-x-1.5"
          >
            {showEmbedded ? <span>Collapse Preview</span> : <span>Embed in Dashboard</span>}
          </button>

          <a
            href={flythroughUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-xs font-mono transition-all flex items-center space-x-1.5 shadow-geo-glow"
          >
            <span>Launch Fullscreen 3D</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {showEmbedded ? (
        <div className="mt-4 rounded-lg overflow-hidden border border-geo-border/80 bg-black aspect-video relative">
          <iframe
            src={flythroughUrl}
            title="DepthWizard 3D Flythrough"
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        </div>
      ) : (
        <div className="mt-4 p-5 rounded-lg bg-geo-surface/30 border border-geo-border/60 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-geo-cyan" />
              <span>Features Available in 3D Flight View</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400 font-mono">
              <div>• Automated spline terrain-following flythrough</div>
              <div>• WASD + Mouse free-flight navigation</div>
              <div>• Click terrain to measure true metric elevation</div>
              <div>• Distance & slope angle calculation between points</div>
              <div>• Color by texture, hypsometric ramp, or slope gradient</div>
              <div>• 3D extruded building footprints & tree models</div>
            </div>
          </div>

          <a
            href={flythroughUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-5 py-3 rounded-lg bg-geo-card border border-cyan-500/40 hover:border-geo-cyan text-xs font-mono text-cyan-300 hover:text-white transition-all flex items-center space-x-2 group shadow-md"
          >
            <Play className="w-4 h-4 text-geo-cyan group-hover:scale-110 transition-transform" />
            <span>Open 3D Viewer ({jobId})</span>
          </a>
        </div>
      )}
    </div>
  );
}
