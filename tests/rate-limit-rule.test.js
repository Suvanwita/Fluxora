process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'fail_open';
process.env.LOG_LEVEL = 'dev';

const request = require('supertest');

const mockUsers = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'owner@example.com',
    name: 'Owner',
    role: 'MEMBER',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'other@example.com',
    name: 'Other',
    role: 'MEMBER',
  },
];
const mockProjects = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    ownerId: mockUsers[0].id,
    status: 'ACTIVE',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    ownerId: mockUsers[1].id,
    status: 'ACTIVE',
  },
];
const mockApiKeys = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    projectId: mockProjects[0].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    projectId: mockProjects[1].id,
  },
];
const mockRules = [];

jest.mock('../src/repositories/auth.repository', () => ({
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(async (id) => {
    return mockUsers.find((user) => user.id === id) || null;
  }),
}));

jest.mock('../src/repositories/project.repository', () => ({
  findProjectByIdAndOwner: jest.fn(async ({ id, ownerId }) => {
    return (
      mockProjects.find(
        (project) => project.id === id && project.ownerId === ownerId && project.status !== 'DELETED',
      ) || null
    );
  }),
}));

jest.mock('../src/repositories/api-key.repository', () => ({
  findApiKeyByIdForOwner: jest.fn(async ({ apiKeyId, ownerId }) => {
    return (
      mockApiKeys.find((apiKey) => {
        const project = mockProjects.find((item) => item.id === apiKey.projectId);
        return apiKey.id === apiKeyId && project?.ownerId === ownerId && project.status !== 'DELETED';
      }) || null
    );
  }),
}));

jest.mock('../src/repositories/rate-limit-rule.repository', () => ({
  countRateLimitRulesByProject: jest.fn(async (projectId) => {
    return mockRules.filter((rule) => rule.projectId === projectId).length;
  }),
  createRateLimitRule: jest.fn(async ({ projectId, data }) => {
    const rule = {
      id: `00000000-0000-4000-8000-${String(mockRules.length + 301).padStart(12, '0')}`,
      projectId,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      ...data,
    };

    mockRules.push(rule);
    return rule;
  }),
  deleteRateLimitRule: jest.fn(async (ruleId) => {
    const index = mockRules.findIndex((rule) => rule.id === ruleId);
    mockRules.splice(index, 1);
  }),
  findRateLimitRuleByIdForOwner: jest.fn(async ({ ruleId, ownerId }) => {
    return (
      mockRules.find((rule) => {
        const project = mockProjects.find((item) => item.id === rule.projectId);
        return rule.id === ruleId && project?.ownerId === ownerId && project.status !== 'DELETED';
      }) || null
    );
  }),
  listRateLimitRulesByProject: jest.fn(async ({ projectId, skip, take }) => {
    return mockRules
      .filter((rule) => rule.projectId === projectId)
      .sort((a, b) => a.priority - b.priority)
      .slice(skip, skip + take);
  }),
  updateRateLimitRule: jest.fn(async ({ ruleId, data }) => {
    const rule = mockRules.find((item) => item.id === ruleId);
    Object.assign(rule, data, { updatedAt: new Date('2026-06-01T01:00:00.000Z') });
    return rule;
  }),
}));

const app = require('../src/app');
const { signToken } = require('../src/utils/jwt');

const ownerToken = signToken({ sub: mockUsers[0].id });
const otherToken = signToken({ sub: mockUsers[1].id });

const authed = (method, path, token = ownerToken) => {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
};

describe('rate limit rule APIs', () => {
  beforeEach(() => {
    mockRules.length = 0;
  });

  it('creates and lists endpoint-pattern rules', async () => {
    const createResponse = await authed(
      'post',
      `/api/v1/projects/${mockProjects[0].id}/rate-limit-rules`,
    ).send({
      name: 'Public API throttle',
      algorithm: 'TOKEN_BUCKET',
      limit: 100,
      windowSeconds: 60,
      refillRate: 10,
      burstCapacity: 50,
      endpointPattern: '/v1/public/**',
      priority: 10,
      metadata: { plan: 'free' },
    });

    const listResponse = await authed('get', `/api/v1/projects/${mockProjects[0].id}/rate-limit-rules`);

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.rule).toMatchObject({
      scope: 'ENDPOINT',
      endpointPattern: '/v1/public/**',
      burstCapacity: 50,
      priority: 10,
      enabled: true,
      metadata: { plan: 'free' },
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.rules).toHaveLength(1);
  });

  it('creates API-key-targeted rules only for owned project keys', async () => {
    const ownedResponse = await authed('post', `/api/v1/projects/${mockProjects[0].id}/rate-limit-rules`).send({
      name: 'Key throttle',
      apiKeyId: mockApiKeys[0].id,
      algorithm: 'FIXED_WINDOW',
      limit: 500,
      windowSeconds: 3600,
    });
    const crossProjectResponse = await authed(
      'post',
      `/api/v1/projects/${mockProjects[0].id}/rate-limit-rules`,
    ).send({
      name: 'Wrong key throttle',
      apiKeyId: mockApiKeys[1].id,
      algorithm: 'FIXED_WINDOW',
      limit: 500,
      windowSeconds: 3600,
    });

    expect(ownedResponse.status).toBe(201);
    expect(ownedResponse.body.data.rule.scope).toBe('API_KEY');
    expect(crossProjectResponse.status).toBe(404);
  });

  it('updates, disables, and enables owned rules', async () => {
    const createResponse = await authed('post', `/api/v1/projects/${mockProjects[0].id}/rate-limit-rules`).send({
      name: 'Project limit',
      algorithm: 'SLIDING_WINDOW',
      limit: 1000,
      windowSeconds: 60,
    });
    const ruleId = createResponse.body.data.rule.id;

    const updateResponse = await authed('patch', `/api/v1/rate-limit-rules/${ruleId}`).send({
      limit: 2000,
      endpointPattern: '/v1/private/**',
    });
    const disableResponse = await authed('post', `/api/v1/rate-limit-rules/${ruleId}/disable`);
    const enableResponse = await authed('post', `/api/v1/rate-limit-rules/${ruleId}/enable`);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.rule).toMatchObject({
      limit: 2000,
      scope: 'ENDPOINT',
      endpointPattern: '/v1/private/**',
    });
    expect(disableResponse.body.data.rule.enabled).toBe(false);
    expect(enableResponse.body.data.rule.enabled).toBe(true);
  });

  it('deletes owned rules and blocks cross-owner actions', async () => {
    const createResponse = await authed('post', `/api/v1/projects/${mockProjects[0].id}/rate-limit-rules`).send({
      name: 'Delete me',
      algorithm: 'FIXED_WINDOW',
      limit: 50,
      windowSeconds: 60,
    });
    const ruleId = createResponse.body.data.rule.id;

    const crossOwnerResponse = await authed('patch', `/api/v1/rate-limit-rules/${ruleId}`, otherToken).send({
      limit: 99,
    });
    const deleteResponse = await authed('delete', `/api/v1/rate-limit-rules/${ruleId}`);

    expect(crossOwnerResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(204);
    expect(mockRules).toHaveLength(0);
  });
});
