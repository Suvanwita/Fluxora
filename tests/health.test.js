const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'fail_open';
process.env.LOG_LEVEL = 'dev';

const app = require('../src/app');

describe('GET /health', () => {
  it('returns the service health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.service).toBe('fluxora');
    expect(response.headers['x-request-id']).toBeDefined();
  });
});
