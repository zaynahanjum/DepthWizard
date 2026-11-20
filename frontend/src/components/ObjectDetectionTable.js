import React, { useState, useMemo } from "react";
import { 
  Box, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  ChevronRight, 
  Trees, 
  Building2, 
  Milestone, 
  Flower2,
  HelpCircle,
  X,
  Layers,
  ArrowUpRight
} from "lucide-react";

export default function ObjectDetectionTable({ 
  geojsonData, 
  sceneData, 
  metadata, 
  selectedObject, 
  onSelectObject 
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [activeModalObject, setActiveModalObject] = useState(null);

  const minElev = metadata?.terrain?.min_elevation_m ?? 0.0;

  // Build a lookup map of ground elevation and height from objects_scene.json
  const sceneMap = useMemo(() => {
    const map = new Map();
    if (sceneData?.objects && Array.isArray(sceneData.objects)) {
      sceneData.objects.forEach((obj) => {
        if (obj.id) {
          map.set(obj.id, {
            groundElevation: minElev + (obj.base_y || 0),
            heightM: obj.height_m,
          });
        }
      });
    }
    return map;
  }, [sceneData, minElev]);

  // Normalize features and enrich with ground and top elevations
  const enrichedFeatures = useMemo(() => {
    if (!geojsonData?.features || !Array.isArray(geojsonData.features)) return [];

    return geojsonData.features.map((feature, idx) => {
      const props = feature.properties || {};
      const objId = props.id || `obj_${idx + 1}`;
      const objClass = (props.class || "other").toLowerCase();
      const heightAboveGround = typeof props.height_above_ground_m === "number" ? props.height_above_ground_m : null;

      // Extract ground elevation from sceneMap if present
      const sceneInfo = sceneMap.get(objId);
      const groundElevation = sceneInfo ? sceneInfo.groundElevation : null;

      // Calculate Top Elevation = Ground Elevation + Height Above Ground
      let topElevation = null;
      if (groundElevation !== null && heightAboveGround !== null) {
        topElevation = groundElevation + heightAboveGround;
      }

      return {
        rawFeature: feature,
        id: objId,
        class: objClass,
        heightAboveGround,
        groundElevation,
        topElevation,
        confidence: typeof props.confidence === "number" ? (props.confidence * 100).toFixed(0) : null,
        source: props.height_source || metadata?.objects?.source || "dummy",
        crownRadius: props.crown_radius_m || null,
        widthM: props.width_m || null,
        geometryType: feature.geometry?.type || "Unknown",
        coordinates: feature.geometry?.coordinates || [],
      };
    });
  }, [geojsonData, sceneMap, metadata]);

  // Aggregate class counts
  const counts = useMemo(() => {
    const res = { total: enrichedFeatures.length, building: 0, tree: 0, road: 0, vegetation: 0, other: 0 };
    enrichedFeatures.forEach((f) => {
      if (res[f.class] !== undefined) {
        res[f.class]++;
      } else {
        res.other++;
      }
    });
    return res;
  }, [enrichedFeatures]);

  // Filter and search
  const filteredFeatures = useMemo(() => {
    return enrichedFeatures.filter((f) => {
      const matchesClass = selectedClassFilter === "all" || f.class === selectedClassFilter;
      const matchesSearch = !searchQuery || f.id.toLowerCase().includes(searchQuery.toLowerCase()) || f.class.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [enrichedFeatures, selectedClassFilter, searchQuery]);

  const isStubData = geojsonData?.stub === true || metadata?.objects?.source === "dummy" || metadata?.objects?.source?.includes("STUB");

  return (
    <div className="bg-geo-card border border-geo-border rounded-xl p-5 shadow-xl">
      {/* Header with Title and Classification Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-geo-border gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <Box className="w-4 h-4 text-geo-cyan" />
              <span>AI Object Detection & Geometry Catalog</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300">
              Part A Predictions
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Detected infrastructure, vegetation, and height estimates parsed from <code className="text-slate-300">objects.geojson</code>
          </p>
        </div>

        {/* Aggregate Counts Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 text-slate-200">
            Total: <strong className="text-cyan-400">{counts.total}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-sky-950/60 border border-sky-800/60 text-sky-300 flex items-center space-x-1">
            <Building2 className="w-3 h-3 text-sky-400" />
            <span>Buildings: <strong>{counts.building}</strong></span>
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 flex items-center space-x-1">
            <Trees className="w-3 h-3 text-emerald-400" />
            <span>Trees: <strong>{counts.tree}</strong></span>
          </span>
          <span className="px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 flex items-center space-x-1">
            <Milestone className="w-3 h-3 text-amber-400" />
            <span>Roads: <strong>{counts.road}</strong></span>
          </span>
        </div>
      </div>

      {/* Model Training Pending / Dummy Notice */}
      {isStubData && (
        <div className="my-4 bg-amber-950/30 border border-amber-900/50 rounded-lg p-3 text-xs text-amber-200/90 flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Testing Stub Predictions Active: </span>
            The objects shown below are generated by <code className="bg-amber-950 px-1 py-0.5 rounded text-amber-300">ml/predict.py</code> stub while Siddu finalizes model training and inference weights. They follow the strict GeoJSON contract and verify the spatial placement pipeline.
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 my-4">
        {/* Class Filter Tabs */}
        <div className="flex items-center space-x-1 bg-geo-surface p-1 rounded-lg border border-geo-border text-xs font-mono w-full sm:w-auto overflow-x-auto">
          {[
            { id: "all", label: "All Classes" },
            { id: "building", label: "Buildings" },
            { id: "tree", label: "Trees" },
            { id: "road", label: "Roads" },
            { id: "vegetation", label: "Vegetation" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedClassFilter(tab.id)}
              className={`px-3 py-1.5 rounded text-xs transition-all ${
                selectedClassFilter === tab.id
                  ? "bg-geo-card text-geo-cyan border border-geo-border font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search object ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-geo-surface border border-geo-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:border-geo-cyan focus:outline-none"
          />
        </div>
      </div>

      {/* Object Catalog Table */}
      <div className="border border-geo-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-geo-surface/80 border-b border-geo-border text-[11px] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Object ID</th>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Height Above Ground</th>
                <th className="py-2.5 px-3">Ground Elevation</th>
                <th className="py-2.5 px-3">Top Elevation</th>
                <th className="py-2.5 px-3">Height Source</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-geo-border/60">
              {filteredFeatures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    No objects match your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredFeatures.map((item) => {
                  const isHighlighted = selectedObject?.properties?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectObject?.(item.rawFeature)}
                      className={`cursor-pointer transition-colors ${
                        isHighlighted
                          ? "bg-cyan-950/40 text-cyan-200"
                          : "hover:bg-geo-surface/50 text-slate-300"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-100 flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-geo-cyan" />
                        <span>{item.id}</span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                            item.class === "building"
                              ? "bg-sky-950/80 border-sky-800 text-sky-300"
                              : item.class === "tree"
                              ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                              : item.class === "road"
                              ? "bg-amber-950/80 border-amber-800 text-amber-300"
                              : "bg-slate-800 border-slate-700 text-slate-300"
                          }`}
                        >
                          {item.class}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        {item.confidence ? `${item.confidence}%` : "—"}
                      </td>

                      <td className="py-2.5 px-3">
                        {item.heightAboveGround !== null ? (
                          <span className="text-cyan-300 font-semibold">
                            {item.heightAboveGround.toFixed(1)} m
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Unknown</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {item.groundElevation !== null ? (
                          <span className="text-emerald-300">
                            {item.groundElevation.toFixed(1)} m
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {item.topElevation !== null ? (
                          <span className="text-white font-bold bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                            {item.topElevation.toFixed(1)} m
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">N/A</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="text-[10px] text-slate-400 capitalize">
                          {item.source}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveModalObject(item);
                          }}
                          className="text-xs text-geo-cyan hover:underline p-1"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Object Details Modal */}
      {activeModalObject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-geo-card border border-geo-border rounded-xl p-6 max-w-lg w-full shadow-2xl relative font-mono">
            <div className="flex items-center justify-between pb-4 border-b border-geo-border">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-100">
                  Feature Properties: {activeModalObject.id}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase">
                  {activeModalObject.class}
                </span>
              </div>
              <button
                onClick={() => setActiveModalObject(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-geo-surface/60 p-3 rounded-lg border border-geo-border">
                <div>
                  <span className="text-slate-400 block text-[10px]">OBJECT CLASS</span>
                  <span className="text-slate-200 capitalize font-bold">{activeModalObject.class}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CONFIDENCE</span>
                  <span className="text-slate-200">{activeModalObject.confidence ? `${activeModalObject.confidence}%` : "Not Provided"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">HEIGHT ABOVE GROUND</span>
                  <span className="text-cyan-300 font-bold">
                    {activeModalObject.heightAboveGround !== null ? `${activeModalObject.heightAboveGround.toFixed(2)} m` : "Unknown (null)"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">GROUND ELEVATION (DEM)</span>
                  <span className="text-emerald-300 font-bold">
                    {activeModalObject.groundElevation !== null ? `${activeModalObject.groundElevation.toFixed(2)} m` : "Not Sampled"}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-geo-border/60">
                  <span className="text-slate-400 block text-[10px]">CALCULATED TOP ELEVATION</span>
                  <span className="text-sm font-bold text-white text-cyan-200">
                    {activeModalObject.topElevation !== null
                      ? `${activeModalObject.topElevation.toFixed(2)} m (= ${activeModalObject.groundElevation.toFixed(2)}m + ${activeModalObject.heightAboveGround.toFixed(2)}m)`
                      : "Cannot calculate (requires both ground and object heights)"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] mb-1">GEOMETRY SPECIFICATION</span>
                <div className="bg-geo-bg p-3 rounded border border-geo-border text-[11px] max-h-36 overflow-y-auto">
                  <p className="text-slate-300">Type: {activeModalObject.geometryType}</p>
                  <pre className="text-slate-400 text-[10px] mt-1 whitespace-pre-wrap">
                    {JSON.stringify(activeModalObject.coordinates, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-geo-border flex justify-end">
              <button
                onClick={() => setActiveModalObject(null)}
                className="px-4 py-2 rounded bg-geo-surface hover:bg-slate-800 text-xs text-slate-200 font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
