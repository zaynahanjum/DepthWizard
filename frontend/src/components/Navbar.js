import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Compass } from "lucide-react";
import { checkBackendHealth } from "../lib/api";

export default function Navbar() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(null);

  useEffect(() => {
    let mounted = true;
    const ping = async () => {
      const status = await checkBackendHealth();
      if (mounted) setIsOnline(status);
    };
    ping();
    const interval = setInterval(ping, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const isActive = (path) => {
    if (path === "/") return router.pathname === "/";
    return router.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white transition-transform group-hover:scale-105">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-slate-900 tracking-tight text-lg">
            DepthWizard
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center space-x-1">
          <Link
            href="/"
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive("/")
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Upload
          </Link>
          <Link
            href="/dashboard"
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive("/dashboard")
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Dashboard
          </Link>
        </nav>

        {/* Status Dot */}
        <div className="flex items-center space-x-2 text-xs font-medium text-slate-500">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline === true
                ? "bg-emerald-500"
                : isOnline === false
                ? "bg-rose-500"
                : "bg-amber-400"
            }`}
          />
          <span className="hidden sm:inline">
            {isOnline === true
              ? "API Connected"
              : isOnline === false
              ? "Offline"
              : "Connecting..."}
          </span>
        </div>
      </div>
    </header>
  );
}
