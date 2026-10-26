import React from 'react';
import { Gauge, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

export default function KpiCards({ stats, loading }) {
  const cards = [
    {
      title: 'Total Smart Meters',
      value: stats?.totalMeters?.toLocaleString() ?? '--',
      icon: Gauge,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Active Meters',
      value: (stats?.statusBreakdown?.Active ?? 0).toLocaleString(),
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Decommissioned',
      value: (stats?.statusBreakdown?.Decommissioned ?? 0).toLocaleString(),
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Distribution Transformers',
      value: (stats?.totalTransformers ?? 0).toLocaleString(),
      icon: Zap,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {card.title}
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '...' : card.value}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-lg ${card.bg} ${card.color} flex items-center justify-center text-xl`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
