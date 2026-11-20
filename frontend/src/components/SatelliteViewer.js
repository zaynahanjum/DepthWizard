import React, { useState, useRef, useEffect } from "react";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Layers, 
  Eye, 
  EyeOff, 
  Info,
  Compass,
  MapPin
} from "lucide-react";
import { getFileUrl } from "../lib/api";

export default function SatelliteViewer({ jobId, metadata, geojsonData, selectedObject, onSelectObject }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showOverlays, setShowOverlays] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  const textureUrl = jobId ? getFileUrl(jobId, "texture.png") : null;

  // Reset viewport
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Zoom controls
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.35, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.35, 0.5));

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.5), 5));
  };

  // Drag to pan
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Normalize GeoJSON features to image coordinates (0% to 100%)
  const extent = metadata?.extent;
  const isGeoreferenced = !!(extent && extent.min_x !== undefined && extent.max_x !== undefined);

  return (
    <div className="bg-geo-card border border-geo-border rounded-xl p-5 shadow-xl flex flex-col h-full">
      {/* Header with Title and Viewport Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-geo-border gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <span>Satellite Imagery Viewer</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300">
              RGB Orthomosaic
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Georeferenced optical imagery draped over the spatial terrain extent
          </p>
        </div>

        {/* Viewport Toolbar */}
        <div className="flex items-center space-x-2">
          {/* Overlays Toggle */}
          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-mono border transition-all ${
              showOverlays
                ? "bg-cyan-950/70 border-cyan-500/60 text-cyan-300"
                : "bg-geo-surface border-geo-border text-slate-400 hover:text-white"
            }`}
            title="Toggle detected object vector footprint overlays"
          >
            {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Vector Overlays</span>
          </button>

          {/* Zoom Buttons */}
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded bg-geo-surface border border-geo-border text-slate-300 hover:text-white hover:border-geo-cyan transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded bg-geo-surface border border-geo-border text-slate-300 hover:text-white hover:border-geo-cyan transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded bg-geo-surface border border-geo-border text-slate-300 hover:text-white hover:border-geo-cyan transition-all"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas / Image Area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative flex-1 min-h-[440px] max-h-[560px] bg-geo-bg border border-geo-border/80 rounded-lg mt-4 overflow-hidden cursor-grab active:cursor-grabbing select-none flex items-center justify-center"
      >
        {/* Geospatial Coordinate Grid Overlay */}
        <div className="absolute inset-0 bg-geo-grid pointer-events-none opacity-40" />

        {/* Zoom Factor HUD */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none bg-geo-card/90 border border-geo-border/80 px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 backdrop-blur-sm">
          Zoom: {(scale * 100).toFixed(0)}%
        </div>

        {/* Loading Spinner */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-geo-bg/80 z-10">
            <div className="w-8 h-8 border-2 border-geo-cyan border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-mono text-slate-400">Loading Orthomosaic Texture...</span>
          </div>
        )}

        {/* Error Fallback */}
        {imageError && (
          <div className="text-center p-6 text-slate-400 text-xs">
            <p className="text-rose-400 font-semibold mb-1">Satellite Texture Not Found</p>
            <p>Ensure the pipeline completed and generated <code className="text-slate-200">texture.png</code>.</p>
          </div>
        )}

        {/* Transform Container */}
        {textureUrl && (
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
            className="relative inline-block max-w-full max-h-full"
          >
            {/* Satellite Image */}
            <img
              ref={imgRef}
              src={textureUrl}
              alt="Satellite Orthomosaic"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className="max-h-[480px] w-auto object-contain rounded shadow-2xl pointer-events-none"
            />

            {/* SVG Vector Overlays for Objects */}
            {imageLoaded && showOverlays && geojsonData?.features && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {geojsonData.features.map((feature, idx) => {
                  const geom = feature.geometry;
                  const props = feature.properties || {};
                  const isSelected = selectedObject?.properties?.id === props.id;
                  const cls = props.class || "building";

                  // Colors by object class
                  let strokeColor = "#38bdf8"; // building (cyan)
                  let fillColor = "rgba(56, 189, 248, 0.25)";
                  if (cls === "tree") {
                    strokeColor = "#34d399"; // emerald
                    fillColor = "rgba(52, 211, 153, 0.4)";
                  } else if (cls === "road") {
                    strokeColor = "#fbbf24"; // amber
                    fillColor = "transparent";
                  }

                  if (isSelected) {
                    strokeColor = "#f43f5e";
                    fillColor = "rgba(244, 63, 94, 0.45)";
                  }

                  // If geographic coordinates exist and we have bbox
                  if (geom.type === "Polygon" && geom.coordinates?.[0] && isGeoreferenced) {
                    const ring = geom.coordinates[0];
                    const pts = ring.map(([lon, lat]) => {
                      const fx = ((lon - extent.min_x) / (extent.max_x - extent.min_x)) * 100;
                      // Image coordinates: Y is inverted (top is max_y)
                      const fy = ((extent.max_y - lat) / (extent.max_y - extent.min_y)) * 100;
                      return `${fx.toFixed(2)},${fy.toFixed(2)}`;
                    }).join(" ");

                    return (
                      <polygon
                        key={idx}
                        points={pts}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? "1.2" : "0.7"}
                        fill={fillColor}
                        className="transition-colors pointer-events-auto cursor-pointer"
                        onClick={() => onSelectObject?.(feature)}
                      />
                    );
                  }

                  if (geom.type === "Point" && geom.coordinates && isGeoreferenced) {
                    const [lon, lat] = geom.coordinates;
                    const cx = ((lon - extent.min_x) / (extent.max_x - extent.min_x)) * 100;
                    const cy = ((extent.max_y - lat) / (extent.max_y - extent.min_y)) * 100;

                    return (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={isSelected ? "2.5" : "1.5"}
                        fill={strokeColor}
                        stroke="#ffffff"
                        strokeWidth="0.4"
                        className="cursor-pointer pointer-events-auto"
                        onClick={() => onSelectObject?.(feature)}
                      />
                    );
                  }

                  return null;
                })}
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Metadata Readout Footer */}
      <div className="mt-4 pt-3 border-t border-geo-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-400">
        <div>
          <span className="text-slate-500 block text-[10px]">RASTER CRS</span>
          <span className="text-slate-200">{metadata?.crs || "N/A"}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">TEXTURE SIZE</span>
          <span className="text-slate-200">
            {metadata?.texture?.width || metadata?.width || "N/A"} × {metadata?.texture?.height || metadata?.height || "N/A"} px
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">OVERLAYS DETECTED</span>
          <span className="text-geo-cyan">
            {geojsonData?.features?.length ?? 0} features
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">INTERACTION</span>
          <span className="text-slate-300">Drag to Pan • Scroll to Zoom</span>
        </div>
      </div>
    </div>
  );
}
