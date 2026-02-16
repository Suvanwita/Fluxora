process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'fail_open';
process.env.LOG_LEVEL = 'dev';

const mockRedis = {
  eval: jest.fn(),
};

jest.mock('../src/config/redis', () => ({
  redis: mockRedis,
}));

const { applyTokenBucket, buildIdentity, buildTokenBucketKey } = require('../src/services/limiter.service');

const rule = {
  id: 'rule_123',
  projectId: 'project_123',
  algorithm: 'TOKEN_BUCKET',
  limit: 10,
  windowSeconds: 60,
  refillRate: 2,
  burstCapacity: 20,
};
const apiKey = {
  id: 'key_123',
  projectId: 'project_123',
};
const now = new Date('2026-06-01T10:15:30.000Z');

describe('token bucket limiter', () => {
  beforeEach(() => {
    mockRedis.eval.mockReset();
  });

  it('uses the expected Redis hash key format', () => {
    const identity = buildIdentity({
      apiKeyId: apiKey.id,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
    });
    const key = buildTokenBucketKey({
      ruleId: rule.id,
      projectId: rule.projectId,
      identity,
    });

    expect(key).toBe('fluxora:rl:token:rule_123:key_123:client_a:GET:_v1_users');
  });

  it('runs the Lua script atomically and parses an allowed result', async () => {
    mockRedis.eval.mockResolvedValue([1, 19, 0, 1780308931]);

    const result = await applyTokenBucket({
      rule,
      apiKey,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
      now,
      cost: 1,
    });

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('HMGET'"),
      1,
      'fluxora:rl:token:rule_123:key_123:client_a:GET:_v1_users',
      20,
      2,
      1780308930,
      1,
      60,
    );
    expect(result).toEqual({
      allowed: true,
      remaining: 19,
      resetAt: '2026-06-01T10:15:31.000Z',
      retryAfter: 0,
      currentCount: 1,
      reason: 'allowed',
    });
  });

  it('parses a denied result with retryAfter and reset estimate', async () => {
    mockRedis.eval.mockResolvedValue([0, 0, 2, 1780308940]);

    const result = await applyTokenBucket({
      rule,
      apiKey,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
      now,
      cost: 3,
    });

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'fluxora:rl:token:rule_123:key_123:client_a:GET:_v1_users',
      20,
      2,
      1780308930,
      3,
      60,
    );
    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      resetAt: '2026-06-01T10:15:40.000Z',
      retryAfter: 2,
      currentCount: 20,
      reason: 'rate_limit_exceeded',
    });
  });
});
