process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'fail_closed';
process.env.LOG_LEVEL = 'dev';

const mockWarn = jest.fn();

jest.mock('../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: (...args) => mockWarn(...args),
  },
}));

const { buildRedisFallbackDecision } = require('../src/services/check.service');

describe('Redis fail-closed fallback', () => {
  it('blocks requests and logs the fallback decision', () => {
    const rule = {
      id: 'rule_123',
      algorithm: 'FIXED_WINDOW',
      limit: 10,
      windowSeconds: 45,
    };

    const decision = buildRedisFallbackDecision({
      error: new Error('Redis unavailable'),
      rule,
    });

    expect(decision).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfter: 45,
      reason: 'redis_unavailable_fail_closed',
    });
    expect(decision.resetAt).toBeDefined();
    expect(mockWarn).toHaveBeenCalledWith(
      'Rate limit fallback decision applied',
      expect.objectContaining({
        mode: 'fail_closed',
        ruleId: 'rule_123',
        allowed: false,
        reason: 'redis_unavailable_fail_closed',
      }),
    );
  });
});
