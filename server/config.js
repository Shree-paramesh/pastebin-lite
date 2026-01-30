/**
 * Server Configuration
 * 
 * This file centralizes all credentials and configuration variables.
 * Update these values or set environment variables accordingly.
 */

module.exports = {
  // Redis/Upstash Configuration
  // Upstash provides REST-based Redis (works with serverless functions)
  redis: {
    url: process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_REST_URL || 'https://expert-swan-61155.upstash.io',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || 'Ae7jAAIncDFkYzYyNDhlOThmN2Q0YjQ0OWVhOWQ1OWNjOTA1ZDRmN3AxNjExNTU'
  },

  // Server Port
  port: process.env.PORT || 3001,

  // Client Configuration
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  // Base URL for generated paste links
  baseUrl: process.env.BASE_URL || null,

  // Node Environment
  nodeEnv: process.env.NODE_ENV || 'development',

  // Test Mode (for deterministic testing with x-test-now-ms header)
  testMode: process.env.TEST_MODE === '1'
};

