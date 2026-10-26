import React, { useState, useEffect } from 'react';
import { X, Bolt, MapPin, ChevronRight, Loader2, ExternalLink } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { API_BASE } from '../config/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function MeterModal({ meterId, onClose }) {
  const [details, setDetails] = useState(null);
  const [consumption, setConsumption] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meterId) return;
    setLoading(true);

    Promise.all([
      fetch(`${API_BASE}/meters/${meterId}`).then((r) => r.json()),
      fetch(`${API_BASE}/meters/${meterId}/consumption`).then((r) => r.json()),
    ])
      .then(([det, cons]) => {
        setDetails(det);
        setConsumption(cons);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [meterId]);

  if (!meterId) return null;

  const readings = consumption?.readings || [];
  const windowReadings = readings.slice(-48);
  const labels = windowReadings.map((r) => r.timestamp.split(' ')[1] || r.timestamp);
  const kwhData = windowReadings.map((r) => r.kwh);
  const voltData = windowReadings.map((r) => r.voltagePhaseR);

  const validVolts = voltData.filter((v) => v != null);
  const avgVolt = validVolts.length ? (validVolts.reduce((a, b) => a + b, 0) / validVolts.length).toFixed(1) : '—';
  const validKwh = kwhData.filter((k) => k != null);
  const netKwh = validKwh.length > 1 ? (validKwh[validKwh.length - 1] - validKwh[0]).toFixed(2) : '0';

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Active Energy (kWh)',
        data: kwhData,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        fill: true,
        tension: 0.2,
        yAxisID: 'yEnergy',
        pointRadius: 2,
      },
      {
        label: 'Phase R Voltage (V)',
        data: voltData,
        borderColor: '#d97706',
        borderDash: [4, 4],
        tension: 0.1,
        yAxisID: 'yVoltage',
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 12, font: { size: 10 } },
      },
      yEnergy: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Cumulative kWh', font: { size: 10 } },
        ticks: { font: { size: 10 } },
      },
      yVoltage: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'Voltage (V)', font: { size: 10 } },
        min: 200,
        max: 260,
        grid: { drawOnChartArea: false },
        ticks: { font: { size: 10 } },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const crumbs = details?.hierarchyBreadcrumbs || [];
  const specs = [
    { label: 'Meter ID', val: details?.meterId },
    { label: 'Serial No', val: details?.serialNumber },
    { label: 'Manufacturer Make', val: details?.make },
    { label: 'Phase Type', val: details?.phaseType },
    { label: 'Installation Status', val: details?.installationStatus },
    { label: 'Installation Type', val: details?.installationType },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-4xl border border-slate-200">
          
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
            <div className="flex items-center space-x-3">
              <span className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                <Bolt className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold leading-6">Meter {meterId}</h3>
                <p className="text-xs text-slate-400">Smart Meter Specification & Telemetry</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {loading ? (
              <div className="py-20 text-center text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-600" />
                Loading meter specification & telemetry curves...
              </div>
            ) : (
              <>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Electrical Hierarchy Trail
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                    {crumbs.map((crumb, idx) => (
                      <React.Fragment key={idx}>
                        <span className="bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs font-medium text-slate-800">
                          {crumb}
                        </span>
                        {idx < crumbs.length - 1 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">
                      Nameplate Specs
                    </h4>
                    <dl className="divide-y divide-slate-100 text-xs">
                      {specs.map((s, idx) => (
                        <div key={idx} className="flex justify-between py-1.5">
                          <dt className="text-slate-500 font-medium">{s.label}</dt>
                          <dd className="font-semibold text-slate-800">{s.val || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3 flex items-center">
                        <MapPin className="h-4 w-4 mr-1 text-rose-500" /> Geographic Location
                      </h4>
                      {details?.coordinates?.latitude && details?.coordinates?.longitude ? (
                        <div className="text-xs space-y-2 text-slate-600">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Latitude:</span>
                            <strong className="font-mono text-slate-800">{details.coordinates.latitude.toFixed(6)}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Longitude:</span>
                            <strong className="font-mono text-slate-800">{details.coordinates.longitude.toFixed(6)}</strong>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No coordinates recorded for this meter.</p>
                      )}
                    </div>

                    {details?.coordinates?.latitude && details?.coordinates?.longitude && (
                      <div className="pt-4">
                        <a
                          href={`https://maps.google.com/?q=${details.coordinates.latitude},${details.coordinates.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex justify-center items-center px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100"
                        >
                          Open in Google Maps <ExternalLink className="h-3 w-3 ml-1 text-blue-500" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Consumption Telemetry Curves</h4>
                      <p className="text-xs text-slate-500">Dual-axis Active Energy (kWh) and Phase Voltage (V)</p>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Active kWh
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        Voltage V(R)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 my-3 text-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block">Total Readings</span>
                      <strong className="text-slate-800 font-semibold">{readings.length}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Avg Voltage</span>
                      <strong className="text-slate-800 font-semibold">{avgVolt} V</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Energy Range</span>
                      <strong className="text-slate-800 font-semibold">Δ {netKwh} kWh</strong>
                    </div>
                  </div>

                  <div className="h-64 relative w-full">
                    {windowReadings.length > 0 ? (
                      <Line data={chartData} options={chartOptions} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        No telemetry readings in window.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-slate-50 px-6 py-3 flex justify-between items-center border-t border-slate-200 text-xs">
            <span className="text-slate-500">Live data fetched & normalized from Urja Meter Ops</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
