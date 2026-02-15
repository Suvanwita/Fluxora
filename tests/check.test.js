process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'allow';
process.env.LOG_LEVEL = 'dev';

const request = require('supertest');

const { hashApiKey } = require('../src/utils/api-key');

const rawApiKey = 'flx_test_public_key';
const apiKeyRecord = {
  id: '00000000-0000-4000-8000-000000000201',
  projectId: '00000000-0000-4000-8000-000000000101',
  keyHash: hashApiKey(rawApiKey),
  status: 'ACTIVE',
  expiresAt: null,
  project: {
    id: '00000000-0000-4000-8000-000000000101',
    status: 'ACTIVE',
  },
};
const matchedRule = {
  id: '00000000-0000-4000-8000-000000000301',
  projectId: apiKeyRecord.projectId,
  apiKeyId: apiKeyRecord.id,
  algorithm: 'FIXED_WINDOW',
  limit: 10,
  windowSeconds: 60,
  refillRate: null,
  burstCapacity: null,
  endpointPattern: '/v1/**',
  priority: 100,
  enabled: true,
  metadata: null,
};

const mockFindApiKeyByHash = jest.fn();
const mockUpdateApiKey = jest.fn(async () => apiKeyRecord);
const mockMatchRateLimitRule = jest.fn();
const mockConsumeLimiter = jest.fn();
const mockAddLogJob = jest.fn(async () => ({}));

jest.mock('../src/repositories/api-key.repository', () => ({
  countApiKeysByProject: jest.fn(),
  createApiKey: jest.fn(),
  findApiKeyByHash: (...args) => mockFindApiKeyByHash(...args),
  findApiKeyByIdForOwner: jest.fn(),
  listApiKeysByProject: jest.fn(),
  updateApiKey: (...args) => mockUpdateApiKey(...args),
}));

jest.mock('../src/services/rate-limit-rule.service', () => ({
  matchRateLimitRule: (...args) => mockMatchRateLimitRule(...args),
}));

jest.mock('../src/services/limiter.service', () => ({
  buildIdentity: jest.fn(() => 'key_identity'),
}));

jest.mock('../src/services/limiterFactory', () => ({
  consume: (...args) => mockConsumeLimiter(...args),
}));

jest.mock('../src/queues/logs.queue', () => ({
  logsQueue: {
    add: (...args) => mockAddLogJob(...args),
  },
}));

const app = require('../src/app');

describe('public check API', () => {
  beforeEach(() => {
    mockFindApiKeyByHash.mockReset();
    mockUpdateApiKey.mockClear();
    mockMatchRateLimitRule.mockReset();
    mockConsumeLimiter.mockReset();
    mockAddLogJob.mockClear();
  });

  it('validates the API key, matches a rule, runs the limiter, enqueues logging, and allows requests', async () => {
    mockFindApiKeyByHash.mockResolvedValue(apiKeyRecord);
    mockMatchRateLimitRule.mockResolvedValue({
      matched: true,
      source: 'custom',
      rule: matchedRule,
    });
    mockConsumeLimiter.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: '2026-06-01T00:01:00.000Z',
      retryAfter: 0,
      reason: 'allowed',
    });

    const response = await request(app).post('/api/v1/check').send({
      apiKey: rawApiKey,
      endpoint: '/v1/users',
      method: 'get',
      clientId: 'client_a',
      requestId: 'req_123',
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      allowed: true,
      algorithm: 'FIXED_WINDOW',
      limit: 10,
      remaining: 9,
      resetAt: '2026-06-01T00:01:00.000Z',
      retryAfter: 0,
      ruleId: matchedRule.id,
      reason: 'allowed',
    });
    expect(mockFindApiKeyByHash).toHaveBeenCalledWith(hashApiKey(rawApiKey));
    expect(mockMatchRateLimitRule).toHaveBeenCalledWith({
      apiKey: apiKeyRecord,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
    });
    expect(mockConsumeLimiter).toHaveBeenCalledWith({
      rule: matchedRule,
      identity: 'key_identity',
      endpoint: '/v1/users',
      requestId: 'req_123',
    });
    expect(mockUpdateApiKey).toHaveBeenCalledWith({
      apiKeyId: apiKeyRecord.id,
      data: {
        lastUsedAt: expect.any(Date),
      },
    });
    expect(mockAddLogJob).toHaveBeenCalledWith(
      'request-log',
      expect.objectContaining({
        apiKeyId: apiKeyRecord.id,
        projectId: apiKeyRecord.projectId,
        requestId: 'req_123',
        decision: 'ALLOWED',
        ruleId: matchedRule.id,
      }),
    );
  });

  it('returns allowed false when the selected limiter denies the request', async () => {
    mockFindApiKeyByHash.mockResolvedValue(apiKeyRecord);
    mockMatchRateLimitRule.mockResolvedValue({
      matched: true,
      source: 'custom',
      rule: matchedRule,
    });
    mockConsumeLimiter.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: '2026-06-01T00:01:00.000Z',
      retryAfter: 12,
      reason: 'rate_limit_exceeded',
    });

    const response = await request(app).post('/api/v1/check').send({
      apiKey: rawApiKey,
      endpoint: '/v1/users',
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfter: 12,
      reason: 'rate_limit_exceeded',
    });
    expect(mockAddLogJob).toHaveBeenCalledWith('request-log', expect.objectContaining({ decision: 'THROTTLED' }));
  });

  it('rejects invalid API keys', async () => {
    mockFindApiKeyByHash.mockResolvedValue(null);

    const response = await request(app).post('/api/v1/check').send({
      apiKey: 'flx_bad',
      endpoint: '/v1/users',
      method: 'GET',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Invalid API key');
    expect(mockConsumeLimiter).not.toHaveBeenCalled();
    expect(mockAddLogJob).not.toHaveBeenCalled();
  });

  it('validates the request body', async () => {
    const response = await request(app).post('/api/v1/check').send({
      apiKey: rawApiKey,
      method: 'GET',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });
});
