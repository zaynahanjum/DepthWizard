import React, { useState, useMemo } from "react";
import { Search, X, ChevronRight, Layers } from "lucide-react";

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

  // Build lookup map from objects_scene.json
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

  // Enrich features with ground and top elevations
  const enrichedFeatures = useMemo(() => {
    if (!geojsonData?.features || !Array.isArray(geojsonData.features)) return [];

    return geojsonData.features.map((feature, idx) => {
      const props = feature.properties || {};
      const objId = props.id || `obj_${idx + 1}`;
      const objClass = (props.class || "other").toLowerCase();
      const heightAboveGround = typeof props.height_above_ground_m === "number" ? props.height_above_ground_m : null;

      const sceneInfo = sceneMap.get(objId);
      const groundElevation = sceneInfo ? sceneInfo.groundElevation : null;

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
        source: props.height_source || metadata?.objects?.source || "model",
        geometryType: feature.geometry?.type || "Unknown",
        coordinates: feature.geometry?.coordinates || [],
      };
    });
  }, [geojsonData, sceneMap, metadata]);

  // Counts
  const counts = useMemo(() => {
    const res = { total: enrichedFeatures.length, building: 0, tree: 0, road: 0, vegetation: 0, other: 0 };
    enrichedFeatures.forEach((f) => {
      if (res[f.class] !== undefined) res[f.class]++;
      else res.other++;
    });
    return res;
  }, [enrichedFeatures]);

  // Filter & search
  const filteredFeatures = useMemo(() => {
    return enrichedFeatures.filter((f) => {
      const matchesClass = selectedClassFilter === "all" || f.class === selectedClassFilter;
      const matchesSearch = !searchQuery || f.id.toLowerCase().includes(searchQuery.toLowerCase()) || f.class.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [enrichedFeatures, selectedClassFilter, searchQuery]);

  const isStubData = geojsonData?.stub === true || metadata?.objects?.source === "dummy" || metadata?.objects?.source?.includes("STUB");

  const classBadges = {
    building: "bg-blue-50 text-blue-700 border-blue-200",
    tree: "bg-emerald-50 text-emerald-700 border-emerald-200",
    road: "bg-amber-50 text-amber-700 border-amber-200",
    vegetation: "bg-teal-50 text-teal-700 border-teal-200",
    other: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">
              Detected Objects
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {counts.total} items
            </span>
            {isStubData && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                Preview Data
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Structures and vegetation with estimated ground and roof elevations.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: `All (${counts.total})` },
            { id: "building", label: `Buildings (${counts.building})` },
            { id: "tree", label: `Trees (${counts.tree})` },
            { id: "road", label: `Roads (${counts.road})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedClassFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedClassFilter === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="my-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search object ID or class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="py-2.5 px-4 font-medium">Object ID</th>
                <th className="py-2.5 px-4 font-medium">Class</th>
                <th className="py-2.5 px-4 font-medium">Confidence</th>
                <th className="py-2.5 px-4 font-medium">Height Above Ground</th>
                <th className="py-2.5 px-4 font-medium">Ground Elevation</th>
                <th className="py-2.5 px-4 font-medium">Top Elevation</th>
                <th className="py-2.5 px-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredFeatures.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No objects match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredFeatures.map((item) => {
                  const isSelected = selectedObject?.properties?.id === item.id;
                  const badgeClass = classBadges[item.class] || classBadges.other;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectObject?.(item.rawFeature)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "hover:bg-slate-50/80 text-slate-700"
                      }`}
                    >
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {item.id}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium border ${badgeClass} capitalize`}>
                          {item.class}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.confidence ? `${item.confidence}%` : "—"}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.heightAboveGround !== null ? `${item.heightAboveGround.toFixed(1)} m` : "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.groundElevation !== null ? `${item.groundElevation.toFixed(1)} m` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {item.topElevation !== null ? (
                          <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {item.topElevation.toFixed(1)} m
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveModalObject(item);
                          }}
                          className="text-xs text-slate-600 hover:text-slate-900 font-sans hover:underline"
                        >
                          Inspect
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

      {/* Modal Inspector */}
      {activeModalObject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  {activeModalObject.id}
                </h4>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize font-medium">
                  {activeModalObject.class}
                </span>
              </div>
              <button
                onClick={() => setActiveModalObject(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Height Above Ground</span>
                  <span className="text-slate-900 font-mono font-semibold text-sm">
                    {activeModalObject.heightAboveGround !== null ? `${activeModalObject.heightAboveGround.toFixed(2)} m` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ground Elevation</span>
                  <span className="text-slate-900 font-mono font-semibold text-sm">
                    {activeModalObject.groundElevation !== null ? `${activeModalObject.groundElevation.toFixed(2)} m` : "—"}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Absolute Top Elevation</span>
                  <span className="text-slate-900 font-mono font-bold text-base">
                    {activeModalObject.topElevation !== null
                      ? `${activeModalObject.topElevation.toFixed(2)} m`
                      : "Cannot calculate (requires ground elevation)"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Coordinates</span>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-[11px] max-h-32 overflow-y-auto text-slate-700">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(activeModalObject.coordinates, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveModalObject(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
