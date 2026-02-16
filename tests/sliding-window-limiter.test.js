process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'fail_open';
process.env.LOG_LEVEL = 'dev';

const mockRedis = {
  zremrangebyscore: jest.fn(),
  zcard: jest.fn(),
  zadd: jest.fn(),
  expire: jest.fn(),
  zrange: jest.fn(),
};

jest.mock('../src/config/redis', () => ({
  redis: mockRedis,
}));

const { applySlidingWindow, buildIdentity, buildSlidingWindowKey } = require('../src/services/limiter.service');

const rule = {
  id: 'rule_123',
  projectId: 'project_123',
  algorithm: 'SLIDING_WINDOW',
  limit: 2,
  windowSeconds: 60,
};
const apiKey = {
  id: 'key_123',
  projectId: 'project_123',
};
const now = new Date('2026-06-01T10:15:30.000Z');

describe('sliding window limiter', () => {
  beforeEach(() => {
    mockRedis.zremrangebyscore.mockReset();
    mockRedis.zcard.mockReset();
    mockRedis.zadd.mockReset();
    mockRedis.expire.mockReset();
    mockRedis.zrange.mockReset();
  });

  it('uses the expected Redis sorted set key format', () => {
    const identity = buildIdentity({
      apiKeyId: apiKey.id,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
    });
    const key = buildSlidingWindowKey({
      ruleId: rule.id,
      projectId: rule.projectId,
      identity,
    });

    expect(key).toBe('fluxora:rl:sliding:rule_123:key_123:client_a:GET:_v1_users');
  });

  it('removes expired entries, adds an allowed request, counts active requests, and sets expiry', async () => {
    mockRedis.zcard.mockResolvedValue(1);
    mockRedis.zrange.mockResolvedValue(['old-member', String(now.getTime() - 10_000)]);

    const result = await applySlidingWindow({
      rule,
      apiKey,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
      requestId: 'req_123',
      now,
    });

    const key = 'fluxora:rl:sliding:rule_123:key_123:client_a:GET:_v1_users';

    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(key, 0, 1780308870000);
    expect(mockRedis.zcard).toHaveBeenCalledWith(key);
    expect(mockRedis.zadd).toHaveBeenCalledWith(key, now.getTime(), `${now.getTime()}:req_123`);
    expect(mockRedis.expire).toHaveBeenCalledWith(key, 60);
    expect(result).toEqual({
      allowed: true,
      remaining: 0,
      resetAt: '2026-06-01T10:16:20.000Z',
      retryAfter: 0,
      currentCount: 2,
      reason: 'allowed',
    });
  });

  it('denies when active count is at the limit and bases retryAfter on the oldest request', async () => {
    mockRedis.zcard.mockResolvedValue(2);
    mockRedis.zrange.mockResolvedValue(['old-member', String(now.getTime() - 45_000)]);

    const result = await applySlidingWindow({
      rule,
      apiKey,
      endpoint: '/v1/users',
      method: 'GET',
      clientId: 'client_a',
      requestId: 'req_456',
      now,
    });

    expect(mockRedis.zadd).not.toHaveBeenCalled();
    expect(mockRedis.expire).toHaveBeenCalledWith(
      'fluxora:rl:sliding:rule_123:key_123:client_a:GET:_v1_users',
      60,
    );
    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      resetAt: '2026-06-01T10:15:45.000Z',
      retryAfter: 15,
      currentCount: 2,
      reason: 'rate_limit_exceeded',
    });
  });
});
