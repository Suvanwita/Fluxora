process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'allow';
process.env.LOG_LEVEL = 'dev';

const mockRules = [];

jest.mock('../src/repositories/rate-limit-rule.repository', () => ({
  countRateLimitRulesByProject: jest.fn(),
  createRateLimitRule: jest.fn(),
  deleteRateLimitRule: jest.fn(),
  findRateLimitRuleByIdForOwner: jest.fn(),
  listEnabledRulesForApiKeyAndProject: jest.fn(async ({ apiKeyId, projectId }) => {
    return mockRules.filter((rule) => {
      return rule.enabled && rule.projectId === projectId && (!rule.apiKeyId || rule.apiKeyId === apiKeyId);
    });
  }),
  listRateLimitRulesByProject: jest.fn(),
  updateRateLimitRule: jest.fn(),
}));

const { matchRateLimitRule } = require('../src/services/rate-limit-rule.service');

const apiKey = {
  id: '00000000-0000-4000-8000-000000000201',
  projectId: '00000000-0000-4000-8000-000000000101',
};

const createRule = (overrides) => ({
  id: `00000000-0000-4000-8000-${String(mockRules.length + 401).padStart(12, '0')}`,
  projectId: apiKey.projectId,
  apiKeyId: null,
  name: 'Rule',
  scope: 'PROJECT',
  algorithm: 'FIXED_WINDOW',
  limit: 100,
  windowSeconds: 60,
  refillRate: null,
  burstCapacity: null,
  endpointPattern: null,
  priority: 1,
  enabled: true,
  metadata: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  ...overrides,
});

describe('rate limit rule matching', () => {
  beforeEach(() => {
    mockRules.length = 0;
  });

  it('chooses the highest-priority matching rule', async () => {
    mockRules.push(
      createRule({ name: 'Low priority', priority: 10, limit: 10 }),
      createRule({ name: 'High priority', priority: 100, limit: 100 }),
    );

    const result = await matchRateLimitRule({
      apiKey,
      endpoint: '/v1/users',
      method: 'GET',
    });

    expect(result).toMatchObject({
      matched: true,
      source: 'custom',
      rule: {
        name: 'High priority',
        limit: 100,
      },
    });
  });

  it('matches endpoint patterns, methods, and client IDs from metadata', async () => {
    mockRules.push(
      createRule({
        name: 'Wrong method',
        endpointPattern: '/v1/private/**',
        priority: 200,
        metadata: {
          methods: ['POST'],
        },
      }),
      createRule({
        name: 'Matching client',
        endpointPattern: '/v1/private/**',
        priority: 100,
        metadata: {
          methods: ['GET'],
          clientIds: ['client_a'],
        },
      }),
    );

    const result = await matchRateLimitRule({
      apiKey,
      endpoint: '/v1/private/accounts/123',
      method: 'get',
      clientId: 'client_a',
    });

    expect(result.rule.name).toBe('Matching client');
  });

  it('loads API-key and project rules but ignores rules for other API keys', async () => {
    mockRules.push(
      createRule({
        name: 'Other key rule',
        apiKeyId: '00000000-0000-4000-8000-000000000999',
        priority: 1000,
      }),
      createRule({
        name: 'This key rule',
        apiKeyId: apiKey.id,
        priority: 20,
      }),
      createRule({
        name: 'Project rule',
        priority: 10,
      }),
    );

    const result = await matchRateLimitRule({
      apiKey,
      endpoint: '/v1/usage',
      method: 'GET',
    });

    expect(result.rule.name).toBe('This key rule');
  });

  it('falls back to a default project-level rule when no custom rule matches', async () => {
    mockRules.push(
      createRule({
        name: 'Endpoint miss',
        endpointPattern: '/v1/admin/**',
        priority: 100,
      }),
    );

    const result = await matchRateLimitRule({
      apiKey,
      endpoint: '/v1/public/health',
      method: 'GET',
    });

    expect(result).toMatchObject({
      matched: false,
      source: 'default',
      rule: {
        projectId: apiKey.projectId,
        scope: 'PROJECT',
        algorithm: 'FIXED_WINDOW',
        limit: 1000,
        windowSeconds: 60,
        isDefault: true,
      },
    });
  });
});
