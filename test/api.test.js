const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app/main');

describe('Flock Energy — Urja Meter Ops API Test Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    const { app } = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /health returns healthy status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
    assert.equal(data.service, 'flock-energy-api');
  });

  test('GET /openapi.json returns valid OpenAPI 3.0 schema', async () => {
    const res = await fetch(`${baseUrl}/openapi.json`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.openapi, '3.0.3');
    assert.ok(data.paths['/api/v1/meters']);
    assert.ok(data.paths['/api/v1/meters/{id}']);
    assert.ok(data.paths['/api/v1/meters/{id}/consumption']);
  });

  test('POST /api/v1/auth/login authenticates against Urja portal', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user, 'operator@urja.local');
  });

  test('GET /api/v1/meters returns paginated meters list', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meters?page=1`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.total > 0);
    assert.equal(data.page, 1);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length > 0);

    const first = data.data[0];
    assert.ok(first.meterId);
    assert.ok(first.serialNumber);
    assert.ok(first.make);
    assert.ok(first.phaseType);
    assert.ok(first.installationStatus);
  });

  test('GET /api/v1/meters with query filters results', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meters?q=J100000`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.data.length > 0);
    assert.equal(data.data[0].meterId, 'J100000');
  });

  test('GET /api/v1/meters/:id returns full meter details and coordinates', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meters/J100000`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.meterId, 'J100000');
    assert.equal(data.serialNumber, 'SE33962');
    assert.equal(data.make, 'HPL');
    assert.ok(data.hierarchy);
    assert.ok(data.hierarchy.zone);
    assert.ok(data.coordinates);
    assert.equal(typeof data.coordinates.latitude, 'number');
    assert.equal(typeof data.coordinates.longitude, 'number');
  });

  test('GET /api/v1/meters/:id returns 404 for non-existent meter', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meters/NON_EXISTENT_99999`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.error, 'Not Found');
  });

  test('GET /api/v1/meters/:id/consumption returns timeseries readings', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meters/J100000/consumption?limit=10`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.meterId, 'J100000');
    assert.equal(data.returnedReadings, 10);
    assert.ok(Array.isArray(data.readings));

    const r = data.readings[0];
    assert.ok(r.timestamp);
    assert.ok(r.isoTimestamp);
    assert.equal(typeof r.kwh, 'number');
    assert.equal(typeof r.voltagePhaseR, 'number');
  });

  test('GET /api/v1/transformers returns distribution transformers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transformers?page=1`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.total > 0);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data[0].code);
    assert.ok(data.data[0].capacityKva);
  });

  test('GET /api/v1/hierarchy returns organized distribution tree', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hierarchy`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.totalMeters > 0);
    assert.ok(data.hierarchy);
    assert.ok(data.hierarchy['Jaipur Zone 1']);
  });

  test('GET /api/v1/export returns complete HMAC-signed dataset', async () => {
    const res = await fetch(`${baseUrl}/api/v1/export`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 403);
    assert.equal(data.meters.length, 403);
  });

  test('GET /api/v1/stats returns aggregated system statistics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/stats`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.totalMeters, 403);
    assert.ok(data.totalTransformers > 0);
    assert.ok(data.statusBreakdown);
  });
});
