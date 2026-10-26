import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import MetersExplorer from './components/MetersExplorer';
import MeterModal from './components/MeterModal';
import HierarchyViewer from './components/HierarchyViewer';
import TransformersGrid from './components/TransformersGrid';

export default function App() {
  const [activeTab, setActiveTab] = useState('meters');
  const [selectedMeterId, setSelectedMeterId] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error('Failed to load stats:', err))
      .finally(() => setStatsLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
      {/* Top Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* KPI Metric Cards */}
        <KpiCards stats={stats} loading={statsLoading} />

        {/* Tab Views */}
        {activeTab === 'meters' && (
          <MetersExplorer onSelectMeter={(id) => setSelectedMeterId(id)} />
        )}

        {activeTab === 'hierarchy' && (
          <HierarchyViewer />
        )}

        {activeTab === 'transformers' && (
          <TransformersGrid />
        )}
      </main>

      {/* Meter Inspection Modal */}
      {selectedMeterId && (
        <MeterModal
          meterId={selectedMeterId}
          onClose={() => setSelectedMeterId(null)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Flock Energy — Urja Meter Ops API & React Dashboard</p>
          <div className="flex space-x-4">
            <a href="/docs" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-900 font-medium">
              Interactive API Docs
            </a>
            <span>•</span>
            <a href="/openapi.json" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-900 font-medium">
              OpenAPI 3.0 Spec
            </a>
            <span>•</span>
            <a href="/health" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-900 font-medium">
              Service Health
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
