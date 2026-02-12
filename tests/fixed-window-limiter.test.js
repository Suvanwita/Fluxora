process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'allow';
process.env.LOG_LEVEL = 'dev';

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

jest.mock('../src/config/redis', () => ({
  redis: mockRedis,
}));

const { applyFixedWindow, buildFixedWindowKey, buildIdentity } = require('../src/services/limiter.service');

const rule = {
  id: 'rule_123',
  projectId: 'project_123',
  algorithm: 'FIXED_WINDOW',
  limit: 2,
  windowSeconds: 60,
};
const apiKey = {
  id: 'key_123',
  projectId: 'project_123',
};
const now = new Date('2026-06-01T10:15:30.000Z');

describe('fixed window limiter', () => {
  beforeEach(() => {
    mockRedis.incr.mockReset();
    mockRedis.expire.mockReset();
  });

  it('uses the expected Redis key format', () => {
    const identity = buildIdentity({
      apiKeyId: apiKey.id,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
    });
    const key = buildFixedWindowKey({
      ruleId: rule.id,
      projectId: rule.projectId,
      identity,
      windowStart: 1780308900,
    });

    expect(key).toBe('fluxora:rl:fixed:rule_123:key_123:client_a:GET:_v1_users:1780308900');
  });

  it('sets expiry on the first request and returns current count', async () => {
    mockRedis.incr.mockResolvedValue(1);

    const result = await applyFixedWindow({
      rule,
      apiKey,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
      now,
    });

    expect(mockRedis.incr).toHaveBeenCalledWith(
      'fluxora:rl:fixed:rule_123:key_123:client_a:GET:_v1_users:1780308900',
    );
    expect(mockRedis.expire).toHaveBeenCalledWith(
      'fluxora:rl:fixed:rule_123:key_123:client_a:GET:_v1_users:1780308900',
      30,
    );
    expect(result).toEqual({
      allowed: true,
      remaining: 1,
      resetAt: '2026-06-01T10:16:00.000Z',
      retryAfter: 0,
      currentCount: 1,
      reason: 'allowed',
    });
  });

  it('does not reset expiry after the first request and denies above the limit', async () => {
    mockRedis.incr.mockResolvedValue(3);

    const result = await applyFixedWindow({
      rule,
      apiKey,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
      now,
    });

    expect(mockRedis.expire).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      allowed: false,
      remaining: 0,
      resetAt: '2026-06-01T10:16:00.000Z',
      retryAfter: 30,
      currentCount: 3,
      reason: 'rate_limit_exceeded',
    });
  });
});
