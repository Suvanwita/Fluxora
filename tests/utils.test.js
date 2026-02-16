process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'fail_open';
process.env.LOG_LEVEL = 'dev';

const { generateApiKey, hashApiKey, verifyApiKeyHash } = require('../src/utils/api-key');
const { matchEndpointPattern } = require('../src/utils/endpoint-matcher');
const { getPagination, getPaginationMeta } = require('../src/utils/pagination');
const { hashPassword, verifyPassword } = require('../src/utils/password');
const { generateRequestId } = require('../src/utils/request-id');
const { getDailyWindow, getFixedWindow, getSlidingWindow } = require('../src/utils/time-window');
const { signToken, verifyToken } = require('../src/utils/jwt');

describe('shared utilities', () => {
  it('builds pagination values and metadata', () => {
    const pagination = getPagination({ page: '3', limit: '500' });
    const meta = getPaginationMeta({ ...pagination, total: 250 });

    expect(pagination).toEqual({ page: 3, limit: 100, skip: 200, take: 100 });
    expect(meta).toMatchObject({
      page: 3,
      limit: 100,
      total: 250,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('generates and verifies API key hashes', () => {
    const { key, keyPrefix } = generateApiKey();
    const hash = hashApiKey(key);

    expect(key).toMatch(/^flx_/);
    expect(keyPrefix).toBe(key.slice(0, 12));
    expect(hash).toHaveLength(64);
    expect(verifyApiKeyHash(key, hash)).toBe(true);
    expect(verifyApiKeyHash(`${key}x`, hash)).toBe(false);
  });

  it('matches endpoint patterns', () => {
    expect(matchEndpointPattern('/v1/users/:id', '/v1/users/123')).toBe(true);
    expect(matchEndpointPattern('/v1/*/usage', '/v1/projects/usage')).toBe(true);
    expect(matchEndpointPattern('/v1/**', '/v1/projects/123/usage')).toBe(true);
    expect(matchEndpointPattern('/v1/users/:id', '/v1/users/123/events')).toBe(false);
  });

  it('calculates time windows', () => {
    const date = new Date('2026-06-01T10:15:30.000Z');

    expect(getFixedWindow(60, date)).toEqual({
      start: 1780308900,
      end: 1780308960,
      ttlSeconds: 30,
    });
    expect(getSlidingWindow(60, date)).toEqual({
      start: 1780308870,
      end: 1780308930,
      ttlSeconds: 60,
    });
    expect(getDailyWindow(date).date.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('generates request IDs', () => {
    expect(generateRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('hashes passwords and signs JWTs', async () => {
    const passwordHash = await hashPassword('correct-horse-battery-staple');
    const token = signToken({ sub: 'user_123' });

    expect(await verifyPassword('correct-horse-battery-staple', passwordHash)).toBe(true);
    expect(await verifyPassword('wrong-password', passwordHash)).toBe(false);
    expect(verifyToken(token).sub).toBe('user_123');
  });
});
