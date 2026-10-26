import React from 'react';
import { Zap, Gauge, Network, BookOpen, ExternalLink, Activity, LogOut, User } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, user, onSignOut }) {
  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-slate-900 shadow">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight">Flock Energy</span>
            <span className="text-xs text-slate-400 block -mt-1">Urja React Explorer</span>
          </div>
        </div>

        <nav className="flex space-x-1 sm:space-x-2">
          <button
            onClick={() => setActiveTab('meters')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'meters'
                ? 'bg-slate-800 text-white border-b-2 border-emerald-500'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Gauge className="h-4 w-4" /> Meters
          </button>
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'hierarchy'
                ? 'bg-slate-800 text-white border-b-2 border-emerald-500'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Network className="h-4 w-4" /> Hierarchy
          </button>
          <button
            onClick={() => setActiveTab('transformers')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'transformers'
                ? 'bg-slate-800 text-white border-b-2 border-emerald-500'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="h-4 w-4" /> Transformers
          </button>
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-md text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors flex items-center gap-1"
          >
            <BookOpen className="h-4 w-4" /> API Docs
            <ExternalLink className="h-3 w-3 ml-0.5" />
          </a>
        </nav>

        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
            <User className="h-3.5 w-3.5 text-emerald-400" />
            <span>{user || 'operator@urja.local'}</span>
          </div>

          <button
            onClick={onSignOut}
            title="Sign out"
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
