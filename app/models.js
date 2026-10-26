function parseIndianDateToIso(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return dateStr;
  const [, day, month, year, hours, minutes] = match;
  return new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10))).toISOString();
}

function formatMeterSummary(raw) {
  return {
    meterId: String(raw.meterId || '').trim(),
    serialNumber: String(raw.serialNo || raw.serialNumber || 'N/A').trim(),
    make: String(raw.make || 'N/A').trim(),
    phaseType: String(raw.phaseType || 'N/A').trim(),
    installationStatus: String(raw.installStatus || raw.installationStatus || 'UNKNOWN').trim(),
    dtCode: String(raw.dtCode || 'N/A').trim(),
  };
}

function formatMeterDetail(raw) {
  return {
    meterId: String(raw.meterId || '').trim(),
    serialNumber: String(raw.serialNumber || 'N/A').trim(),
    make: String(raw.make || 'N/A').trim(),
    phaseType: String(raw.phaseType || 'N/A').trim(),
    installationStatus: String(raw.installationStatus || 'UNKNOWN').trim(),
    installationType: String(raw.installationType || 'N/A').trim(),
    hierarchy: raw.hierarchy || {},
    hierarchyBreadcrumbs: Array.isArray(raw.hierarchyBreadcrumbs) ? raw.hierarchyBreadcrumbs : [],
    coordinates: raw.coordinates ? {
      latitude: raw.coordinates.latitude != null ? parseFloat(raw.coordinates.latitude) : null,
      longitude: raw.coordinates.longitude != null ? parseFloat(raw.coordinates.longitude) : null,
    } : null,
  };
}

function formatConsumptionReading(raw) {
  return {
    timestamp: String(raw.timestamp || '').trim(),
    isoTimestamp: parseIndianDateToIso(raw.timestamp),
    kwh: raw.kwh != null && raw.kwh !== '' ? parseFloat(raw.kwh) : null,
    kvah: raw.kvah != null && raw.kvah !== '' ? parseFloat(raw.kvah) : null,
    voltagePhaseR: raw.voltR != null && raw.voltR !== '' ? parseFloat(raw.voltR) : (raw.voltagePhaseR != null ? parseFloat(raw.voltagePhaseR) : null),
  };
}

function formatTransformer(raw) {
  return {
    code: String(raw.code || '').trim(),
    name: String(raw.name || '').trim(),
    feederCode: String(raw.feederCode || '').trim(),
    capacityKva: raw.capacityKva != null ? parseFloat(raw.capacityKva) : null,
  };
}

module.exports = {
  parseIndianDateToIso,
  formatMeterSummary,
  formatMeterDetail,
  formatConsumptionReading,
  formatTransformer,
};
