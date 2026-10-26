import React, { useState, useEffect } from 'react';
import { Map, ChevronDown, ChevronRight, Layers, Building, Radio, Zap, Loader2, ArrowUpDown } from 'lucide-react';

export default function HierarchyViewer() {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collapsedZones, setCollapsedZones] = useState({});

  useEffect(() => {
    setLoading(true);
    fetch('/api/v1/hierarchy')
      .then((r) => r.json())
      .then((data) => setHierarchy(data.hierarchy || {}))
      .catch((err) => console.error('Failed to load hierarchy:', err))
      .finally(() => setLoading(false));
  }, []);

  const toggleZone = (zoneName) => {
    setCollapsedZones((prev) => ({
      ...prev,
      [zoneName]: !prev[zoneName],
    }));
  };

  const toggleAll = () => {
    const hasAnyCollapsed = Object.values(collapsedZones).some(Boolean);
    const newCollapsed = {};
    if (hierarchy) {
      Object.keys(hierarchy).forEach((z) => {
        newCollapsed[z] = !hasAnyCollapsed;
      });
    }
    setCollapsedZones(newCollapsed);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="pb-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Electrical Distribution Network Hierarchy</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Explore the grid hierarchy down from Zone to Circle, Division, Feeder, and Transformer
          </p>
        </div>
        <button
          onClick={toggleAll}
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white hover:bg-slate-50 flex items-center gap-1.5"
        >
          <ArrowUpDown className="h-3.5 w-3.5" /> Expand / Collapse All
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-500" />
          Reconstructing electrical grid topology...
        </div>
      ) : !hierarchy || Object.keys(hierarchy).length === 0 ? (
        <div className="text-center py-12 text-slate-400">No hierarchy data found.</div>
      ) : (
        <div className="mt-4 space-y-4">
          {Object.entries(hierarchy).map(([zoneName, zone]) => {
            const isCollapsed = collapsedZones[zoneName];
            const circleCount = Object.keys(zone.circles || {}).length;

            return (
              <div key={zoneName} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div
                  onClick={() => toggleZone(zoneName)}
                  className="bg-slate-100/80 px-4 py-3 flex items-center justify-between cursor-pointer font-bold text-slate-800 hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Map className="h-4 w-4 text-blue-600" />
                    <span>{zoneName} {zone.code ? `(${zone.code})` : ''}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs font-normal text-slate-500">
                    <span>{circleCount} circles</span>
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-4 space-y-3 font-mono text-xs">
                    {Object.entries(zone.circles || {}).map(([circleName, circle]) => (
                      <div key={circleName} className="tree-node ml-2">
                        <div className="font-semibold text-slate-700 py-1 flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-slate-400" /> {circleName}
                        </div>
                        <div className="ml-4 space-y-1">
                          {Object.entries(circle.divisions || {}).map(([divName, div]) => (
                            <div key={divName} className="tree-node">
                              <div className="font-medium text-slate-600 py-0.5 flex items-center gap-1.5">
                                <Building className="h-3.5 w-3.5 text-slate-400" /> {divName}
                              </div>
                              <div className="ml-4 space-y-1">
                                {Object.entries(div.subdivisions || {}).map(([subdivName, subdiv]) => (
                                  <div key={subdivName} className="tree-node">
                                    <div className="text-slate-500 py-0.5">{subdivName}</div>
                                    <div className="ml-4 space-y-1">
                                      {Object.entries(subdiv.substations || {}).map(([stnName, stn]) => (
                                        <div key={stnName} className="tree-node">
                                          <div className="text-slate-500 py-0.5 flex items-center gap-1">
                                            <Radio className="h-3 w-3 text-purple-400" /> {stnName}
                                          </div>
                                          <div className="ml-4 space-y-2 mt-1">
                                            {Object.entries(stn.feeders || {}).map(([fName, f]) => (
                                              <div key={fName} className="tree-node">
                                                <span className="text-amber-700 font-medium">⚡ {fName}</span>
                                                <div className="ml-4 flex flex-wrap gap-2 mt-1">
                                                  {Object.entries(f.dts || {}).map(([dtName, dt]) => (
                                                    <span
                                                      key={dtName}
                                                      className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200"
                                                    >
                                                      <Zap className="h-3 w-3 text-slate-400 mr-1" />
                                                      {dtName}
                                                      <strong className="ml-1 text-blue-600">
                                                        ({dt.meters?.length || 0} meters)
                                                      </strong>
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
