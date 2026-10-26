const config = require('./config');
const createApp = require('./app');

const { app } = createApp();

const server = app.listen(config.port, () => {
  console.log('====================================================');
  console.log(`🚀 Urja Meter Ops API Service running on port ${config.port}`);
  console.log(`📊 Interactive Dashboard:  http://localhost:${config.port}/`);
  console.log(`📖 Interactive API Docs:   http://localhost:${config.port}/docs`);
  console.log(`📄 Raw OpenAPI Spec:       http://localhost:${config.port}/openapi.json`);
  console.log(`⚡ Connected to portal:     ${config.urja.baseUrl}`);
  console.log('====================================================');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => console.log('HTTP server closed'));
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => console.log('HTTP server closed'));
});
