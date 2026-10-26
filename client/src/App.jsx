import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import MetersExplorer from './components/MetersExplorer';
import MeterModal from './components/MeterModal';
import HierarchyViewer from './components/HierarchyViewer';
import TransformersGrid from './components/TransformersGrid';
import LoginPage from './components/LoginPage';
import { API_BASE } from './config/api';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('urja_auth');
  });
  const [user, setUser] = useState(() => {
    return localStorage.getItem('urja_user') || 'operator@urja.local';
  });

  const [activeTab, setActiveTab] = useState('meters');
  const [selectedMeterId, setSelectedMeterId] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const path = window.location.pathname;

    if (!isAuthenticated) {
      if (path !== '/login') {
        window.history.replaceState({}, '', '/login');
      }
      return;
    }

    if (path === '/login') {
      window.history.replaceState({}, '', '/meters');
      setActiveTab('meters');
    } else if (path.startsWith('/meters/')) {
      const id = path.replace('/meters/', '').trim();
      if (id) {
        setSelectedMeterId(id);
        setActiveTab('meters');
      }
    } else if (path === '/meters') {
      setActiveTab('meters');
    } else if (path === '/hierarchy') {
      setActiveTab('hierarchy');
    } else if (path === '/transformers') {
      setActiveTab('transformers');
    }

    const onPopState = () => {
      const p = window.location.pathname;
      if (!isAuthenticated) return;
      if (p.startsWith('/meters/')) {
        setSelectedMeterId(p.replace('/meters/', '').trim());
        setActiveTab('meters');
      } else if (p === '/meters') {
        setSelectedMeterId(null);
        setActiveTab('meters');
      } else if (p === '/hierarchy') {
        setSelectedMeterId(null);
        setActiveTab('hierarchy');
      } else if (p === '/transformers') {
        setSelectedMeterId(null);
        setActiveTab('transformers');
      } else {
        setSelectedMeterId(null);
        setActiveTab('meters');
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setStatsLoading(true);
    fetch(`${API_BASE}/api/v1/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err))
      .finally(() => setStatsLoading(false));
  }, [isAuthenticated]);

  const handleLoginSuccess = (loginData) => {
    const loggedUser = loginData?.user || 'operator@urja.local';
    localStorage.setItem('urja_auth', 'true');
    localStorage.setItem('urja_user', loggedUser);
    setUser(loggedUser);
    setIsAuthenticated(true);
    window.history.pushState({}, '', '/meters');
  };

  const handleSignOut = () => {
    localStorage.removeItem('urja_auth');
    localStorage.removeItem('urja_user');
    setIsAuthenticated(false);
    setSelectedMeterId(null);
    window.history.pushState({}, '', '/login');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedMeterId(null);
    window.history.pushState({}, '', `/${tab}`);
  };

  const handleSelectMeter = (id) => {
    setSelectedMeterId(id);
    window.history.pushState({}, '', `/meters/${id}`);
  };

  const handleCloseModal = () => {
    setSelectedMeterId(null);
    window.history.pushState({}, '', '/meters');
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        user={user}
        onSignOut={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <KpiCards stats={stats} loading={statsLoading} />

        {activeTab === 'meters' && (
          <MetersExplorer onSelectMeter={handleSelectMeter} />
        )}

        {activeTab === 'hierarchy' && (
          <HierarchyViewer />
        )}

        {activeTab === 'transformers' && (
          <TransformersGrid />
        )}
      </main>

      {selectedMeterId && (
        <MeterModal
          meterId={selectedMeterId}
          onClose={handleCloseModal}
        />
      )}

      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Flock Energy — Urja Meter Ops API & React Dashboard</p>
          <div className="flex space-x-4">
            <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-900 font-medium">
              Interactive API Docs
            </a>
            <span>•</span>
            <a href={`${API_BASE}/openapi.json`} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-900 font-medium">
              OpenAPI 3.0 Spec
            </a>
            <span>•</span>
            <a href={`${API_BASE}/health`} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-900 font-medium">
              Service Health
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
