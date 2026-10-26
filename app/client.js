const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const {
  formatMeterSummary,
  formatMeterDetail,
  formatConsumptionReading,
  formatTransformer,
} = require('./models');

class UrjaPortalClient {
  constructor(config = {}) {
    this.baseUrl = (config.baseUrl || 'https://urja-ops.flockenergy.tech').replace(/\/$/, '');
    this.username = config.username || 'operator@urja.local';
    this.password = config.password || 'urja-ops-2026';
    this.cookieJar = new CookieJar();
    this.isAuthenticated = false;
    this.loginPromise = null;

    // Axios client wrapped with tough-cookie jar support
    this.http = wrapper(
      axios.create({
        jar: this.cookieJar,
        withCredentials: true,
        timeout: 15000,
        headers: {
          'Origin': this.baseUrl,
          'Referer': `${this.baseUrl}/`,
          'User-Agent': 'FlockEnergy-UrjaClient/1.0',
        },
      })
    );

    // Response interceptor to catch session expiration and re-authenticate
    this.http.interceptors.response.use(
      (response) => {
        // If SvelteKit redirects to login page or indicates login needed
        if (typeof response.data === 'string' && response.data.includes('Urja Meter Ops — Sign in') && !response.config.url.includes('/login')) {
          const err = new Error('Session expired');
          err.isAuthError = true;
          err.config = response.config;
          return Promise.reject(err);
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        if (
          (error.response?.status === 401 || error.isAuthError) &&
          !originalRequest._retry &&
          !originalRequest.url.includes('/login')
        ) {
          originalRequest._retry = true;
          this.isAuthenticated = false;
          await this.login();
          return this.http(originalRequest);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Log in to the Urja portal and establish a session cookie
   */
  async login(username = null, password = null) {
    if (this.loginPromise) return this.loginPromise;

    this.loginPromise = (async () => {
      const email = username || this.username;
      const pass = password || this.password;
      const url = `${this.baseUrl}/login`;

      const params = new URLSearchParams();
      params.append('email', email);
      params.append('password', pass);

      try {
        const response = await this.http.post(url, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': this.baseUrl,
            'Referer': `${this.baseUrl}/login`,
          },
          maxRedirects: 0,
          validateStatus: (status) => status === 200 || status === 303 || status === 302,
        });

        // Portal returns { type: 'redirect', status: 303, location: '/meters' }
        if (response.status === 200 && response.data && response.data.type === 'redirect') {
          this.isAuthenticated = true;
          return { success: true, user: email, location: response.data.location };
        }

        if (response.status === 302 || response.status === 303) {
          this.isAuthenticated = true;
          return { success: true, user: email };
        }

        throw new Error('Invalid login response from Urja portal');
      } finally {
        this.loginPromise = null;
      }
    })();

    return this.loginPromise;
  }

  /**
   * Ensure the client has an active authenticated session
   */
  async ensureAuthenticated() {
    if (!this.isAuthenticated) {
      await this.login();
    }
  }

  /**
   * Search meters list with pagination and search query
   */
  async searchMeters(query = '', page = 1) {
    await this.ensureAuthenticated();
    const url = `${this.baseUrl}/portal/meters/search?q=${encodeURIComponent(query)}&page=${page}`;
    const response = await this.http.get(url);
    const data = response.data;

    return {
      total: data.total ?? (data.data ? data.data.length : 0),
      page: parseInt(page, 10),
      pageSize: data.data ? data.data.length : 0,
      data: (data.data || []).map(formatMeterSummary),
    };
  }

  /**
   * Get detailed meter information (nameplate, location, hierarchy)
   * Fetches HTML page from /meters/:id and parses with Cheerio, plus geo endpoint
   */
  async getMeterDetails(meterId) {
    await this.ensureAuthenticated();

    const [pageRes, geoRes] = await Promise.allSettled([
      this.http.get(`${this.baseUrl}/meters/${meterId}`),
      this.http.get(`${this.baseUrl}/portal/meters/${meterId}/geo`),
    ]);

    if (pageRes.status === 'rejected') {
      const errStatus = pageRes.reason?.response?.status;
      if (errStatus === 404) {
        const error = new Error(`Meter ${meterId} not found`);
        error.status = 404;
        throw error;
      }
      throw pageRes.reason;
    }

    const html = pageRes.value.data;
    const $ = cheerio.load(html);

    // Extract hierarchy breadcrumbs from nav
    const hierarchyTokens = [];
    $('nav.flex.flex-wrap.gap-1 span').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text !== '›') {
        hierarchyTokens.push(text);
      }
    });

    // Map breadcrumbs to hierarchy structure
    const hierarchyKeys = ['zone', 'circle', 'division', 'subdivision', 'substation', 'feeder', 'dt'];
    const hierarchy = {};
    hierarchyTokens.forEach((token, idx) => {
      if (idx < hierarchyKeys.length) {
        hierarchy[hierarchyKeys[idx]] = token;
      }
    });

    // Extract nameplate specifications from dl / dt / dd
    const nameplate = {};
    $('dl.divide-y.divide-slate-100 > div').each((i, el) => {
      const label = $(el).find('dt').text().trim();
      const val = $(el).find('dd').text().trim();
      if (label) {
        nameplate[label] = val;
      }
    });

    // Geo coordinates
    let coordinates = null;
    if (geoRes.status === 'fulfilled' && geoRes.value.data?.data) {
      const geo = geoRes.value.data.data;
      coordinates = {
        latitude: geo.latitude,
        longitude: geo.longitude,
      };
    }

    return formatMeterDetail({
      meterId: nameplate['Meter ID'] || meterId,
      serialNumber: nameplate['Serial No'] || 'N/A',
      make: nameplate['Make'] || 'N/A',
      phaseType: nameplate['Phase Type'] || 'N/A',
      installationStatus: nameplate['Installation Status'] || 'UNKNOWN',
      installationType: nameplate['Installation Type'] || 'N/A',
      hierarchy,
      hierarchyBreadcrumbs: hierarchyTokens,
      coordinates,
    });
  }

  /**
   * Get consumption history (timeseries readings) for a meter
   */
  async getMeterConsumption(meterId) {
    await this.ensureAuthenticated();
    const url = `${this.baseUrl}/portal/meters/${meterId}/energy`;
    const response = await this.http.get(url);
    const rawReadings = response.data?.data || [];

    const readings = rawReadings.map(formatConsumptionReading);

    return {
      meterId,
      totalReadings: readings.length,
      readings,
    };
  }

  /**
   * Get distribution transformers list
   */
  async getTransformers(page = 1) {
    await this.ensureAuthenticated();
    const url = `${this.baseUrl}/portal/dts?page=${page}`;
    const response = await this.http.get(url);
    const data = response.data || {};

    return {
      total: data.total || 0,
      page: parseInt(page, 10),
      data: (data.data || []).map(formatTransformer),
    };
  }

  /**
   * Bulk export all meters using the HMAC-SHA256 authenticated export endpoint
   */
  async exportAllMeters() {
    await this.ensureAuthenticated();

    // 1. Fetch signing secret
    const keysRes = await this.http.get(`${this.baseUrl}/portal/keys`);
    const secret = keysRes.data?.data?.signingSecret;
    if (!secret) {
      throw new Error('Failed to retrieve portal export signing secret');
    }

    // 2. Generate HMAC signature
    const timestamp = String(Math.floor(Date.now() / 1000));
    const method = 'GET';
    const path = '/portal/export';
    const query = 'page=1';
    const message = [method, path, query, timestamp].join('\n');
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');

    // 3. Request bulk export
    const exportRes = await this.http.get(`${this.baseUrl}/portal/export?${query}`, {
      headers: {
        'x-timestamp': timestamp,
        'x-signature': signature,
      },
    });

    const body = exportRes.data || {};
    const meters = (body.data || []).map((m) => ({
      meterId: m.meterId,
      serialNumber: m.serialNo,
      make: m.make,
      phaseType: m.phaseType,
      installationStatus: m.installStatus,
      installationType: m.installType,
      build: m.build,
      dtCode: m.dtCode,
      hierarchy: m.hierarchy,
      coordinates: m.geo ? { latitude: m.geo.lat, longitude: m.geo.lng } : null,
    }));

    return {
      total: body.total || meters.length,
      exportedAt: new Date().toISOString(),
      meters,
    };
  }

  /**
   * Reconstruct full electrical distribution network hierarchy
   */
  async getHierarchy() {
    const exportResult = await this.exportAllMeters();
    const meters = exportResult.meters;

    // Build hierarchy tree: Zone -> Circle -> Division -> Subdivision -> Substation -> Feeder -> DT -> Meters
    const hierarchyTree = {};

    for (const meter of meters) {
      const h = meter.hierarchy || {};
      const zoneName = h.zone?.name || 'Unknown Zone';
      const circleName = h.circle?.name || 'Unknown Circle';
      const divName = h.division?.name || 'Unknown Division';
      const subdivName = h.subdivision?.name || 'Unknown Subdivision';
      const subStnName = h.substation?.name || 'Unknown Substation';
      const feederName = h.feeder?.name || 'Unknown Feeder';
      const dtName = h.dt?.name || meter.dtCode || 'Unknown DT';

      if (!hierarchyTree[zoneName]) hierarchyTree[zoneName] = { code: h.zone?.code, circles: {} };
      const zoneNode = hierarchyTree[zoneName];

      if (!zoneNode.circles[circleName]) zoneNode.circles[circleName] = { code: h.circle?.code, divisions: {} };
      const circleNode = zoneNode.circles[circleName];

      if (!circleNode.divisions[divName]) circleNode.divisions[divName] = { code: h.division?.code, subdivisions: {} };
      const divNode = circleNode.divisions[divName];

      if (!divNode.subdivisions[subdivName]) divNode.subdivisions[subdivName] = { code: h.subdivision?.code, substations: {} };
      const subdivNode = divNode.subdivisions[subdivName];

      if (!subdivNode.substations[subStnName]) subdivNode.substations[subStnName] = { code: h.substation?.code, feeders: {} };
      const subStnNode = subdivNode.substations[subStnName];

      if (!subStnNode.feeders[feederName]) subStnNode.feeders[feederName] = { code: h.feeder?.code, dts: {} };
      const feederNode = subStnNode.feeders[feederName];

      if (!feederNode.dts[dtName]) feederNode.dts[dtName] = { code: h.dt?.code || meter.dtCode, meters: [] };
      feederNode.dts[dtName].meters.push({
        meterId: meter.meterId,
        serialNumber: meter.serialNumber,
        status: meter.installationStatus,
        make: meter.make,
      });
    }

    return {
      totalMeters: meters.length,
      hierarchy: hierarchyTree,
    };
  }
}

module.exports = UrjaPortalClient;
