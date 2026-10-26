const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const UrjaPortalClient = require('./client');
const MemoryCache = require('./cache');
const createApiRouter = require('./routes/api');

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

  // Serve static assets for modern web dashboard
  app.use(express.static(path.join(__dirname, '../public')));

  // Serve raw openapi.json
  app.get('/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openapiSpec);
  });

  // Serve interactive Swagger documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Flock Energy — Urja Meter Ops API Docs',
  }));

  // Mount API endpoints under /api/v1
  app.use('/api/v1', createApiRouter(client, cache));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'flock-energy-api',
      timestamp: new Date().toISOString(),
      cacheSize: cache.size(),
    });
  });

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Endpoint ${req.originalUrl} does not exist`,
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('API Error:', err.message, err.stack);
    const status = err.status || 500;
    res.status(status).json({
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred while processing your request',
    });
  });

  return { app, client, cache };
}

module.exports = createApp;
