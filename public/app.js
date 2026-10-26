let currentPage = 1;
let currentSearch = '';
let currentStatus = '';
let currentPhase = '';
let chartInstance = null;
let hierarchyData = null;

// DOM Elements
const tabMeters = document.getElementById('tab-meters');
const tabHierarchy = document.getElementById('tab-hierarchy');
const tabTransformers = document.getElementById('tab-transformers');

const viewMeters = document.getElementById('view-meters');
const viewHierarchy = document.getElementById('view-hierarchy');
const viewTransformers = document.getElementById('view-transformers');

const metersTableBody = document.getElementById('meters-table-body');
const inputSearch = document.getElementById('input-search');
const selectStatus = document.getElementById('select-status');
const selectPhase = document.getElementById('select-phase');
const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
const paginationInfo = document.getElementById('pagination-info');
const paginationCurrent = document.getElementById('pagination-current');

const meterModal = document.getElementById('meter-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalFooterClose = document.getElementById('modal-footer-close');
const btnExportAll = document.getElementById('btn-export-all');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupEventListeners();
  loadStats();
  loadMeters(1);
});

// Setup Tab Navigation
function setupTabs() {
  const tabs = [
    { btn: tabMeters, view: viewMeters },
    { btn: tabHierarchy, view: viewHierarchy, onLoad: loadHierarchy },
    { btn: tabTransformers, view: viewTransformers, onLoad: loadTransformers },
  ];

  tabs.forEach(({ btn, view, onLoad }) => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.classList.remove('active', 'text-white', 'bg-slate-800');
        t.btn.classList.add('text-slate-300');
        t.view.classList.add('hidden');
        t.view.classList.remove('block');
      });

      btn.classList.add('active', 'text-white', 'bg-slate-800');
      btn.classList.remove('text-slate-300');
      view.classList.remove('hidden');
      view.classList.add('block');

      if (onLoad) onLoad();
    });
  });
}

// Setup Event Listeners
function setupEventListeners() {
  let searchTimeout = null;
  inputSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadMeters(currentPage);
    }, 300);
  });

  selectStatus.addEventListener('change', (e) => {
    currentStatus = e.target.value;
    currentPage = 1;
    loadMeters(currentPage);
  });

  selectPhase.addEventListener('change', (e) => {
    currentPhase = e.target.value;
    currentPage = 1;
    loadMeters(currentPage);
  });

  btnPrevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadMeters(currentPage);
    }
  });

  btnNextPage.addEventListener('click', () => {
    currentPage++;
    loadMeters(currentPage);
  });

  [modalClose, modalFooterClose, modalBackdrop].forEach(el => {
    el.addEventListener('click', closeMeterModal);
  });

  btnExportAll.addEventListener('click', handleExportAll);
}

// Load KPI Stats
async function loadStats() {
  try {
    const res = await fetch('/api/v1/stats');
    if (!res.ok) return;
    const stats = await res.json();

    document.getElementById('kpi-total-meters').textContent = stats.totalMeters.toLocaleString();
    document.getElementById('kpi-active-meters').textContent = (stats.statusBreakdown?.Active || 0).toLocaleString();
    document.getElementById('kpi-decom-meters').textContent = (stats.statusBreakdown?.Decommissioned || 0).toLocaleString();
    document.getElementById('kpi-total-dts').textContent = stats.totalTransformers.toLocaleString();
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Load Smart Meters
async function loadMeters(page = 1) {
  metersTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="px-5 py-8 text-center text-slate-400">
        <i class="fa-solid fa-spinner fa-spin mr-2"></i> Fetching meters...
      </td>
    </tr>
  `;

  try {
    const params = new URLSearchParams({
      page,
      q: currentSearch,
      status: currentStatus,
      phase: currentPhase,
    });

    const res = await fetch(`/api/v1/meters?${params.toString()}`);
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      metersTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="px-5 py-8 text-center text-slate-500">
            <i class="fa-solid fa-inbox text-2xl text-slate-300 block mb-2"></i>
            No meters matching query found.
          </td>
        </tr>
      `;
      paginationInfo.textContent = '0 meters found';
      btnPrevPage.disabled = true;
      btnNextPage.disabled = true;
      return;
    }

    renderMetersTable(data.data);

    // Update Pagination
    const totalPages = Math.max(1, Math.ceil(data.total / 20));
    paginationCurrent.textContent = `Page ${page} of ${totalPages}`;
    paginationInfo.textContent = `Showing ${(page - 1) * 20 + 1}–${Math.min(page * 20, data.total)} of ${data.total} meters`;
    btnPrevPage.disabled = page <= 1;
    btnNextPage.disabled = page >= totalPages;
  } catch (err) {
    metersTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-5 py-8 text-center text-rose-500">
          <i class="fa-solid fa-circle-exclamation mr-1"></i> Error loading meters: ${err.message}
        </td>
      </tr>
    `;
  }
}

// Render Table Rows
function renderMetersTable(meters) {
  metersTableBody.innerHTML = meters.map(meter => {
    const isActive = (meter.installationStatus || '').toLowerCase() === 'active';
    const statusBadgeClass = isActive 
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' 
      : 'bg-amber-50 text-amber-700 ring-amber-600/20';

    return `
      <tr class="hover:bg-slate-50/80 transition-colors cursor-pointer group" onclick="openMeterModal('${meter.meterId}')">
        <td class="px-5 py-3 font-semibold text-blue-600 group-hover:underline">
          ${meter.meterId}
        </td>
        <td class="px-5 py-3 font-mono text-slate-600">
          ${meter.serialNumber || '—'}
        </td>
        <td class="px-5 py-3 text-slate-700">
          ${meter.make || '—'}
        </td>
        <td class="px-5 py-3 capitalize text-slate-600">
          ${meter.phaseType || '—'}
        </td>
        <td class="px-5 py-3">
          <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusBadgeClass}">
            ${meter.installationStatus || 'UNKNOWN'}
          </span>
        </td>
        <td class="px-5 py-3 font-mono text-slate-500 text-xs">
          ${meter.dtCode || '—'}
        </td>
        <td class="px-5 py-3 text-right">
          <button class="text-slate-400 group-hover:text-blue-600 transition-colors text-xs font-medium inline-flex items-center">
            Inspect <i class="fa-solid fa-arrow-right ml-1"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Meter Modal
async function openMeterModal(meterId) {
  meterModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  document.getElementById('modal-meter-title').textContent = `Meter ${meterId}`;
  document.getElementById('modal-meter-subtitle').textContent = 'Loading specification & telemetry...';
  document.getElementById('modal-breadcrumbs').innerHTML = '<span class="text-slate-400">Loading trail...</span>';
  document.getElementById('modal-nameplate').innerHTML = '<div class="py-4 text-center text-slate-400">Loading...</div>';
  document.getElementById('modal-geo').innerHTML = '<span class="text-slate-400">Loading coordinates...</span>';
  document.getElementById('modal-geo-link').innerHTML = '';

  try {
    const [detailRes, consumptionRes] = await Promise.all([
      fetch(`/api/v1/meters/${meterId}`).then(r => r.json()),
      fetch(`/api/v1/meters/${meterId}/consumption`).then(r => r.json()),
    ]);

    // Render Breadcrumbs
    const crumbs = detailRes.hierarchyBreadcrumbs || [];
    document.getElementById('modal-breadcrumbs').innerHTML = crumbs.map((crumb, idx) => `
      <span class="bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs font-medium text-slate-800">${crumb}</span>
      ${idx < crumbs.length - 1 ? '<i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>' : ''}
    `).join('') || '<span class="text-slate-400">No hierarchy trail</span>';

    // Render Nameplate Specs
    const specs = [
      { label: 'Meter ID', val: detailRes.meterId },
      { label: 'Serial No', val: detailRes.serialNumber },
      { label: 'Manufacturer Make', val: detailRes.make },
      { label: 'Phase Type', val: detailRes.phaseType },
      { label: 'Installation Status', val: detailRes.installationStatus },
      { label: 'Installation Type', val: detailRes.installationType },
    ];
    document.getElementById('modal-nameplate').innerHTML = specs.map(s => `
      <div class="flex justify-between py-1.5">
        <dt class="text-slate-500 font-medium">${s.label}</dt>
        <dd class="font-semibold text-slate-800">${s.val || '—'}</dd>
      </div>
    `).join('');

    // Render Coordinates
    if (detailRes.coordinates?.latitude && detailRes.coordinates?.longitude) {
      const lat = detailRes.coordinates.latitude.toFixed(6);
      const lng = detailRes.coordinates.longitude.toFixed(6);
      document.getElementById('modal-geo').innerHTML = `
        <div class="flex justify-between"><span class="text-slate-500">Latitude:</span><strong class="font-mono text-slate-800">${lat}</strong></div>
        <div class="flex justify-between"><span class="text-slate-500">Longitude:</span><strong class="font-mono text-slate-800">${lng}</strong></div>
      `;
      document.getElementById('modal-geo-link').innerHTML = `
        <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" class="w-full inline-flex justify-center items-center px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100">
          <i class="fa-brands fa-google mr-1.5 text-blue-500"></i> Open in Google Maps
        </a>
      `;
    } else {
      document.getElementById('modal-geo').innerHTML = '<span class="text-slate-400">No coordinates recorded for this meter.</span>';
    }

    // Render Consumption Chart
    renderConsumptionChart(consumptionRes.readings || []);
  } catch (err) {
    console.error('Error loading meter details:', err);
  }
}

// Close Modal
function closeMeterModal() {
  meterModal.classList.add('hidden');
  document.body.style.overflow = '';
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

// Render Dual-Axis Chart with Chart.js
function renderConsumptionChart(readings) {
  const ctx = document.getElementById('consumptionChart').getContext('2d');
  if (chartInstance) {
    chartInstance.destroy();
  }

  if (!readings || readings.length === 0) {
    document.getElementById('chart-total-readings').textContent = '0';
    document.getElementById('chart-avg-voltage').textContent = '—';
    document.getElementById('chart-energy-range').textContent = '—';
    return;
  }

  // Take recent 48 intervals (24 hours) for crisp visualization
  const windowReadings = readings.slice(-48);
  const labels = windowReadings.map(r => r.timestamp.split(' ')[1] || r.timestamp);
  const kwhData = windowReadings.map(r => r.kwh);
  const voltData = windowReadings.map(r => r.voltagePhaseR);

  // Compute stats
  const validVolts = voltData.filter(v => v != null);
  const avgVolt = validVolts.length ? (validVolts.reduce((a, b) => a + b, 0) / validVolts.length).toFixed(1) : '—';
  const validKwh = kwhData.filter(k => k != null);
  const netKwh = validKwh.length > 1 ? (validKwh[validKwh.length - 1] - validKwh[0]).toFixed(2) : '0';

  document.getElementById('chart-total-readings').textContent = readings.length;
  document.getElementById('chart-avg-voltage').textContent = `${avgVolt} V`;
  document.getElementById('chart-energy-range').textContent = `Δ ${netKwh} kWh`;

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
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
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 12, font: { size: 10 } }
        },
        yEnergy: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Cumulative kWh', font: { size: 10 } },
          ticks: { font: { size: 10 } }
        },
        yVoltage: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Voltage (V)', font: { size: 10 } },
          min: 200,
          max: 260,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10 } }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Load Network Hierarchy
async function loadHierarchy() {
  const container = document.getElementById('hierarchy-container');
  if (hierarchyData) return;

  try {
    const res = await fetch('/api/v1/hierarchy');
    const data = await res.json();
    hierarchyData = data.hierarchy;

    let html = '';
    for (const [zoneName, zone] of Object.entries(hierarchyData)) {
      html += `
        <div class="border border-slate-200 rounded-xl overflow-hidden bg-white mb-4 shadow-sm">
          <div class="bg-slate-100/80 px-4 py-3 flex items-center justify-between cursor-pointer font-bold text-slate-800" onclick="toggleAccordion('zone-${zone.code}')">
            <span><i class="fa-solid fa-map text-blue-600 mr-2"></i> ${zoneName} (${zone.code || 'Z'})</span>
            <span class="text-xs font-normal text-slate-500">${Object.keys(zone.circles || {}).length} circles</span>
          </div>
          <div id="zone-${zone.code}" class="p-4 space-y-3">
            ${renderCircles(zone.circles)}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="text-rose-500 py-6 text-center">Failed to load hierarchy: ${err.message}</div>`;
  }
}

function renderCircles(circles) {
  if (!circles) return '';
  return Object.entries(circles).map(([circleName, circle]) => `
    <div class="tree-node ml-2">
      <div class="font-semibold text-slate-700 text-xs py-1 flex items-center">
        <i class="fa-solid fa-circle-nodes text-slate-400 mr-1.5"></i> ${circleName}
      </div>
      <div class="ml-4 space-y-1">
        ${renderDivisions(circle.divisions)}
      </div>
    </div>
  `).join('');
}

function renderDivisions(divisions) {
  if (!divisions) return '';
  return Object.entries(divisions).map(([divName, div]) => `
    <div class="tree-node">
      <div class="font-medium text-slate-600 text-xs py-0.5">
        <i class="fa-solid fa-building text-slate-400 mr-1.5"></i> ${divName}
      </div>
      <div class="ml-4 space-y-1">
        ${renderSubdivisions(div.subdivisions)}
      </div>
    </div>
  `).join('');
}

function renderSubdivisions(subdivs) {
  if (!subdivs) return '';
  return Object.entries(subdivs).map(([subdivName, subdiv]) => `
    <div class="tree-node">
      <div class="text-slate-500 text-xs py-0.5">
        <i class="fa-solid fa-diagram-project text-slate-400 mr-1.5"></i> ${subdivName}
      </div>
      <div class="ml-4 space-y-1">
        ${renderFeedersAndDts(subdiv.substations)}
      </div>
    </div>
  `).join('');
}

function renderFeedersAndDts(substations) {
  if (!substations) return '';
  return Object.entries(substations).map(([stnName, stn]) => `
    <div class="tree-node">
      <div class="text-slate-500 text-xs py-0.5">
        <i class="fa-solid fa-industry text-purple-400 mr-1.5"></i> ${stnName}
      </div>
      <div class="ml-4">
        ${Object.entries(stn.feeders || {}).map(([fName, f]) => `
          <div class="tree-node">
            <span class="text-xs text-amber-700 font-medium"><i class="fa-solid fa-plug text-amber-500 mr-1"></i> ${fName}</span>
            <div class="ml-4 flex flex-wrap gap-2 mt-1">
              ${Object.entries(f.dts || {}).map(([dtName, dt]) => `
                <span class="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs border border-slate-200">
                  <i class="fa-solid fa-bolt-lightning text-slate-400 mr-1"></i> ${dtName} 
                  <strong class="ml-1 text-blue-600">(${dt.meters?.length || 0} meters)</strong>
                </span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

window.toggleAccordion = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
};

// Load Transformers
async function loadTransformers() {
  const grid = document.getElementById('transformers-grid');
  try {
    const res = await fetch('/api/v1/transformers?page=1');
    const data = await res.json();

    grid.innerHTML = (data.data || []).map(dt => `
      <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-colors">
        <div class="flex items-start justify-between">
          <div>
            <span class="text-xs font-mono text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
              ${dt.code}
            </span>
            <h4 class="font-bold text-slate-900 mt-2 text-sm">${dt.name}</h4>
          </div>
          <span class="h-9 w-9 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center text-sm">
            <i class="fa-solid fa-bolt-lightning"></i>
          </span>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-slate-400 block">Feeder Code</span>
            <strong class="font-mono text-slate-700">${dt.feederCode}</strong>
          </div>
          <div>
            <span class="text-slate-400 block">Rated Capacity</span>
            <strong class="text-slate-700">${dt.capacityKva} kVA</strong>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full text-rose-500 py-6 text-center">Failed to load transformers: ${err.message}</div>`;
  }
}

// Bulk Export Handler
async function handleExportAll() {
  const btn = btnExportAll;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Fetching HMAC Export...';

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
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}
