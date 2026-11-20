import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Compass, Layers, Globe, Radio, Sparkles, ExternalLink, Activity } from "lucide-react";
import { checkBackendHealth, API_BASE_URL } from "../lib/api";

export default function Navbar() {
  const router = useRouter();
  const [isBackendOnline, setIsBackendOnline] = useState(null);

  useEffect(() => {
    let mounted = true;
    const verifyHealth = async () => {
      const status = await checkBackendHealth();
      if (mounted) setIsBackendOnline(status);
    };

    verifyHealth();
    const interval = setInterval(verifyHealth, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const isActive = (path) => router.pathname === path;

  return (
    <header className="sticky top-0 z-50 border-b border-geo-border bg-geo-bg/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 flex items-center justify-center shadow-geo-glow group-hover:border-cyan-400 transition-all">
                <Compass className="w-5 h-5 text-geo-cyan transition-transform group-hover:rotate-45" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent">
                    DepthWizard
                  </span>
                  <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300">
                    v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono hidden md:block">
                  Geospatial Depth & 3D Terrain Calibration
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                isActive("/")
                  ? "bg-geo-card text-geo-cyan border border-geo-border"
                  : "text-slate-300 hover:text-white hover:bg-geo-surface"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4" />
                <span>Upload & Process</span>
              </div>
            </Link>

            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                router.pathname.startsWith("/dashboard")
                  ? "bg-geo-card text-geo-cyan border border-geo-border"
                  : "text-slate-300 hover:text-white hover:bg-geo-surface"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <span>Results Dashboard</span>
              </div>
            </Link>
          </nav>

          {/* Backend Status & Team Metadata */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-full bg-geo-surface border border-geo-border">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isBackendOnline === true
                      ? "bg-emerald-400"
                      : isBackendOnline === false
                      ? "bg-rose-400"
                      : "bg-amber-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isBackendOnline === true
                      ? "bg-emerald-500"
                      : isBackendOnline === false
                      ? "bg-rose-500"
                      : "bg-amber-500"
                  }`}
                ></span>
              </span>
              <span className="text-slate-300">
                {isBackendOnline === true
                  ? "API Online"
                  : isBackendOnline === false
                  ? "API Offline"
                  : "Checking API..."}
              </span>
            </div>

            <div className="hidden lg:flex flex-col text-right">
              <span className="text-[11px] font-semibold text-slate-300">
                Sahyadri CSE
              </span>
              <span className="text-[10px] text-slate-500">
                Dept. of CSE
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
