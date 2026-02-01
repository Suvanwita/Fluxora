const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';

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
