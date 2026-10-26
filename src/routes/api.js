const express = require('express');
const router = express.Router();

module.exports = function createApiRouter(client, cache) {
  /**
   * Helper: cache wrapper for async handlers
   */
  async function withCache(cacheKey, ttlSeconds, fetcher) {
    if (cache) {
      const cached = cache.get(cacheKey);
      if (cached) return { data: cached, cached: true };
    }
    const fresh = await fetcher();
    if (cache) {
      cache.set(cacheKey, fresh, ttlSeconds);
    }
    return { data: fresh, cached: false };
  }

  /**
   * POST /api/v1/auth/login
   * Manual authentication check or login with custom credentials
   */
  router.post('/auth/login', async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      const result = await client.login(username, password);
      res.json({
        success: true,
        message: 'Successfully authenticated with Urja portal',
        user: result.user,
        authenticatedAt: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/meters
   * List/search smart meters with pagination and optional filtering
   */
  router.get('/meters', async (req, res, next) => {
    try {
      const q = req.query.q || '';
      const page = parseInt(req.query.page || '1', 10);
      const statusFilter = req.query.status ? req.query.status.toLowerCase() : null;
      const phaseFilter = req.query.phase ? req.query.phase.toLowerCase() : null;
      const makeFilter = req.query.make ? req.query.make.toLowerCase() : null;

      const cacheKey = `meters:q=${q}:p=${page}`;
      const { data, cached } = await withCache(cacheKey, 60, () => client.searchMeters(q, page));

      let filteredData = [...data.data];

      if (statusFilter) {
        filteredData = filteredData.filter(m => (m.installationStatus || '').toLowerCase().includes(statusFilter));
      }
      if (phaseFilter) {
        filteredData = filteredData.filter(m => (m.phaseType || '').toLowerCase() === phaseFilter);
      }
      if (makeFilter) {
        filteredData = filteredData.filter(m => (m.make || '').toLowerCase() === makeFilter);
      }

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json({
        total: data.total,
        page: data.page,
        count: filteredData.length,
        data: filteredData,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/meters/:id
   * Get specific meter details, nameplate specs, geo coordinates, and hierarchy
   */
  router.get('/meters/:id', async (req, res, next) => {
    try {
      const meterId = req.params.id;
      const cacheKey = `meter:${meterId}`;

      const { data, cached } = await withCache(cacheKey, 300, () => client.getMeterDetails(meterId));

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json(data);
    } catch (err) {
      if (err.status === 404 || err.message?.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Meter with ID '${req.params.id}' was not found in Urja portal`,
        });
      }
      next(err);
    }
  });

  /**
   * GET /api/v1/meters/:id/consumption
   * Get timeseries energy consumption readings for a meter
   */
  router.get('/meters/:id/consumption', async (req, res, next) => {
    try {
      const meterId = req.params.id;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
      const sort = (req.query.sort || 'asc').toLowerCase();

      const cacheKey = `consumption:${meterId}`;
      const { data, cached } = await withCache(cacheKey, 120, () => client.getMeterConsumption(meterId));

      let readings = [...data.readings];
      if (sort === 'desc') {
        readings.reverse();
      }
      if (limit && limit > 0) {
        readings = readings.slice(0, limit);
      }

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json({
        meterId: data.meterId,
        totalReadings: data.totalReadings,
        returnedReadings: readings.length,
        sort,
        readings,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/transformers
   * Retrieve list of distribution transformers
   */
  router.get('/transformers', async (req, res, next) => {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const cacheKey = `dts:p=${page}`;

      const { data, cached } = await withCache(cacheKey, 300, () => client.getTransformers(page));

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/hierarchy
   * Retrieve the complete organized network hierarchy tree
   */
  router.get('/hierarchy', async (req, res, next) => {
    try {
      const cacheKey = 'hierarchy:full';
      const { data, cached } = await withCache(cacheKey, 600, () => client.getHierarchy());

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/export
   * Retrieve the complete dataset of all smart meters with metadata
   */
  router.get('/export', async (req, res, next) => {
    try {
      const cacheKey = 'export:all';
      const { data, cached } = await withCache(cacheKey, 600, () => client.exportAllMeters());

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/stats
   * Aggregated metrics for dashboard view
   */
  router.get('/stats', async (req, res, next) => {
    try {
      const cacheKey = 'stats:summary';
      const { data, cached } = await withCache(cacheKey, 600, async () => {
        const exportRes = await client.exportAllMeters();
        const meters = exportRes.meters;

        const statusCounts = {};
        const makeCounts = {};
        const phaseCounts = {};
        const dtSet = new Set();

        for (const m of meters) {
          statusCounts[m.installationStatus] = (statusCounts[m.installationStatus] || 0) + 1;
          makeCounts[m.make] = (makeCounts[m.make] || 0) + 1;
          phaseCounts[m.phaseType] = (phaseCounts[m.phaseType] || 0) + 1;
          if (m.dtCode) dtSet.add(m.dtCode);
        }

        return {
          totalMeters: meters.length,
          totalTransformers: dtSet.size,
          statusBreakdown: statusCounts,
          makeBreakdown: makeCounts,
          phaseBreakdown: phaseCounts,
          generatedAt: new Date().toISOString(),
        };
      });

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
