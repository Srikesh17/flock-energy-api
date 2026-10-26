const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const UrjaPortalClient = require('./client');
const MemoryCache = require('./cache');

function createApp(customClient = null, customCache = null) {
  const app = express();
  const client = customClient || new UrjaPortalClient(config.urja);
  const cache = customCache || new MemoryCache(config.cache.ttlSeconds);

  // Load OpenAPI specification
  const openapiSpec = require(path.join(__dirname, '../openapi.json'));

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static assets for modern React web dashboard
  app.use(express.static(path.join(__dirname, '../public')));

  // Raw OpenAPI specification
  app.get('/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openapiSpec);
  });

  // Interactive Swagger UI documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Flock Energy — Urja Meter Ops API Docs',
  }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'flock-energy-api',
      timestamp: new Date().toISOString(),
      cacheSize: cache.size(),
    });
  });

  // Helper: Cache wrapper
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

  // ==========================================
  // REST API Routes (/api/v1)
  // ==========================================
  const apiRouter = express.Router();

  // POST /api/v1/auth/login
  apiRouter.post('/auth/login', async (req, res, next) => {
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

  // GET /api/v1/meters
  apiRouter.get('/meters', async (req, res, next) => {
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

  // GET /api/v1/meters/:id
  apiRouter.get('/meters/:id', async (req, res, next) => {
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

  // GET /api/v1/meters/:id/consumption
  apiRouter.get('/meters/:id/consumption', async (req, res, next) => {
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

  // GET /api/v1/transformers
  apiRouter.get('/transformers', async (req, res, next) => {
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

  // GET /api/v1/hierarchy
  apiRouter.get('/hierarchy', async (req, res, next) => {
    try {
      const cacheKey = 'hierarchy:full';
      const { data, cached } = await withCache(cacheKey, 600, () => client.getHierarchy());

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/export
  apiRouter.get('/export', async (req, res, next) => {
    try {
      const cacheKey = 'export:all';
      const { data, cached } = await withCache(cacheKey, 600, () => client.exportAllMeters());

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/stats
  apiRouter.get('/stats', async (req, res, next) => {
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

  app.use('/api/v1', apiRouter);

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Endpoint ${req.originalUrl} does not exist`,
    });
  });

  // SPA fallback for HTML5 routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('API Error:', err.message);
    const status = err.status || 500;
    res.status(status).json({
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred while processing your request',
    });
  });

  return { app, client, cache };
}

// Start standalone server if run directly
if (require.main === module) {
  const { app } = createApp();
  const server = app.listen(config.port, () => {
    console.log('====================================================');
    console.log(`🚀 Urja Meter Ops API Service running on port ${config.port}`);
    console.log(`📊 React Web Dashboard:    http://localhost:${config.port}/`);
    console.log(`📖 Interactive API Docs:   http://localhost:${config.port}/docs`);
    console.log(`📄 Raw OpenAPI Spec:       http://localhost:${config.port}/openapi.json`);
    console.log(`⚡ Connected to portal:     ${config.urja.baseUrl}`);
    console.log('====================================================');
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => console.log('HTTP server closed'));
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => console.log('HTTP server closed'));
  });
}

module.exports = createApp;
