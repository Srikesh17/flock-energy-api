import React, { useState, useEffect } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { API_BASE } from '../config/api';

export default function TransformersGrid() {
  const [transformers, setTransformers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/v1/transformers?page=1`)
      .then((r) => r.json())
      .then((data) => setTransformers(data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="pb-6 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-900">Distribution Transformers (DTs)</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Transformer assets, assigned electrical feeder codes, and rated kVA capacities
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-500" />
          Loading transformer assets...
        </div>
      ) : transformers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No transformers found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {transformers.map((dt) => (
            <div
              key={dt.code}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                    {dt.code}
                  </span>
                  <h4 className="font-bold text-slate-900 mt-2 text-sm">{dt.name}</h4>
                </div>
                <span className="h-9 w-9 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center text-sm">
                  <Zap className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Feeder Code</span>
                  <strong className="font-mono text-slate-700">{dt.feederCode}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Rated Capacity</span>
                  <strong className="text-slate-700">{dt.capacityKva} kVA</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
