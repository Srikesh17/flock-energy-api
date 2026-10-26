require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  urja: {
    baseUrl: (process.env.URJA_BASE_URL || 'https://urja-ops.flockenergy.tech').replace(/\/$/, ''),
    username: process.env.URJA_USERNAME || 'operator@urja.local',
    password: process.env.URJA_PASSWORD || 'urja-ops-2026',
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  }
};

module.exports = config;
