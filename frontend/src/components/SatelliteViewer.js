import React, { useState, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff } from "lucide-react";
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

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.3, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.3, 0.5));

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.5), 5));
  };

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

  const extent = metadata?.extent;
  const isGeoreferenced = !!(extent && extent.min_x !== undefined && extent.max_x !== undefined);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-subtle flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 tracking-tight">
            Satellite Imagery
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            RGB orthomosaic cropped to terrain extent
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
              showOverlays
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Overlays</span>
          </button>

          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Reset view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Viewport Canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative flex-1 min-h-[400px] max-h-[520px] bg-slate-50 border border-slate-200 rounded-xl mt-4 overflow-hidden cursor-grab active:cursor-grabbing select-none flex items-center justify-center"
      >
        {/* Loading Spinner */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-10">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-medium">Loading imagery...</span>
          </div>
        )}

        {/* Error Fallback */}
        {imageError && (
          <div className="text-center p-6 text-slate-500 text-xs">
            <p className="font-medium text-slate-700">Unable to load texture.png</p>
          </div>
        )}

        {/* Zoom Factor */}
        <div className="absolute bottom-3 left-3 z-20 pointer-events-none bg-white/90 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-mono text-slate-600 shadow-sm">
          {(scale * 100).toFixed(0)}%
        </div>

        {/* Image & Overlays */}
        {textureUrl && (
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
            className="relative inline-block max-w-full max-h-full"
          >
            <img
              ref={imgRef}
              src={textureUrl}
              alt="Satellite"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className="max-h-[460px] w-auto object-contain rounded pointer-events-none"
            />

            {/* SVG Vectors */}
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

                  let strokeColor = "#0284c7"; // sky
                  let fillColor = "rgba(2, 132, 199, 0.2)";
                  if (cls === "tree") {
                    strokeColor = "#059669"; // emerald
                    fillColor = "rgba(5, 150, 105, 0.3)";
                  } else if (cls === "road") {
                    strokeColor = "#d97706"; // amber
                    fillColor = "transparent";
                  }

                  if (isSelected) {
                    strokeColor = "#e11d48";
                    fillColor = "rgba(225, 29, 72, 0.35)";
                  }

                  if (geom.type === "Polygon" && geom.coordinates?.[0] && isGeoreferenced) {
                    const ring = geom.coordinates[0];
                    const pts = ring.map(([lon, lat]) => {
                      const fx = ((lon - extent.min_x) / (extent.max_x - extent.min_x)) * 100;
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
                        className="pointer-events-auto cursor-pointer"
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
                        strokeWidth="0.5"
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

      {/* Footer info */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-mono">
        <span>CRS: {metadata?.crs || "—"}</span>
        <span>
          {metadata?.texture?.width || metadata?.width || "—"} × {metadata?.texture?.height || metadata?.height || "—"} px
        </span>
      </div>
    </div>
  );
}
