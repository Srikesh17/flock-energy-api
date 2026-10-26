import React, { useState, useEffect } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, ArrowRight, Loader2, Inbox } from 'lucide-react';

export default function MetersExplorer({ onSelectMeter }) {
  const [meters, setMeters] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [phase, setPhase] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMeters(page, search, status, phase);
    }, 250);
    return () => clearTimeout(timer);
  }, [page, search, status, phase]);

  const fetchMeters = async (p, q, s, ph) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p,
        q,
        status: s,
        phase: ph,
      });
      const res = await fetch(`/api/v1/meters?${params.toString()}`);
      const data = await res.json();
      setMeters(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch meters:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/v1/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urja-meters-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      {/* Header & Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Smart Meters Directory</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Click any meter row to inspect full telemetry, location, and consumption curves
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {exporting ? 'Generating HMAC Export...' : 'Export All (HMAC Bulk)'}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 py-2">
        <div className="sm:col-span-6 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Meter ID (e.g. J100000) or Serial..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Decommissioned">Decommissioned</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={phase}
            onChange={(e) => {
              setPhase(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
          >
            <option value="">All Phases</option>
            <option value="single">Single Phase</option>
            <option value="three">Three Phase</option>
          </select>
        </div>
      </div>

      {/* Meters Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3">Meter ID</th>
              <th className="px-5 py-3">Serial No</th>
              <th className="px-5 py-3">Manufacturer</th>
              <th className="px-5 py-3">Phase</th>
              <th className="px-5 py-3">Installation Status</th>
              <th className="px-5 py-3">DT Code</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-500" />
                  Fetching meters data...
                </td>
              </tr>
            ) : meters.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                  <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  No meters matching query found.
                </td>
              </tr>
            ) : (
              meters.map((meter) => {
                const isActive = (meter.installationStatus || '').toLowerCase() === 'active';
                const statusBadge = isActive
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                  : 'bg-amber-50 text-amber-700 ring-amber-600/20';

                return (
                  <tr
                    key={meter.meterId}
                    onClick={() => onSelectMeter(meter.meterId)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3 font-semibold text-blue-600 group-hover:underline">
                      {meter.meterId}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600">
                      {meter.serialNumber || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {meter.make || '—'}
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-600">
                      {meter.phaseType || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusBadge}`}>
                        {meter.installationStatus || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-500 text-xs">
                      {meter.dtCode || '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-slate-400 group-hover:text-blue-600 transition-colors text-xs font-medium inline-flex items-center">
                        Inspect <ArrowRight className="h-3 w-3 ml-1" />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 text-sm">
        <span className="text-slate-500">
          Showing {meters.length > 0 ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)} of {total} meters
        </span>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </button>
          <span className="px-3 py-1.5 font-medium text-slate-800">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
