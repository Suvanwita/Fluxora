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

const mockUsers = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'owner@example.com',
    name: 'Owner',
    role: 'MEMBER',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'other@example.com',
    name: 'Other',
    role: 'MEMBER',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  },
];
const mockProjects = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    ownerId: mockUsers[0].id,
    name: 'Core API',
    slug: 'core-api',
    description: null,
    status: 'ACTIVE',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    ownerId: mockUsers[1].id,
    name: 'Other API',
    slug: 'other-api',
    description: null,
    status: 'ACTIVE',
  },
];
const mockApiKeys = [];

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
  countApiKeysByProject: jest.fn(async (projectId) => {
    return mockApiKeys.filter((apiKey) => apiKey.projectId === projectId).length;
  }),
  createApiKey: jest.fn(async ({ projectId, name, keyPrefix, keyHash, expiresAt }) => {
    const apiKey = {
      id: `00000000-0000-4000-8000-${String(mockApiKeys.length + 201).padStart(12, '0')}`,
      projectId,
      name,
      keyPrefix,
      keyHash,
      status: 'ACTIVE',
      expiresAt,
      lastUsedAt: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };

    mockApiKeys.push(apiKey);
    return apiKey;
  }),
  findApiKeyByIdForOwner: jest.fn(async ({ apiKeyId, ownerId }) => {
    return (
      mockApiKeys.find((apiKey) => {
        const project = mockProjects.find((item) => item.id === apiKey.projectId);
        return apiKey.id === apiKeyId && project?.ownerId === ownerId && project.status !== 'DELETED';
      }) || null
    );
  }),
  listApiKeysByProject: jest.fn(async ({ projectId, skip, take }) => {
    return mockApiKeys.filter((apiKey) => apiKey.projectId === projectId).slice(skip, skip + take);
  }),
  updateApiKey: jest.fn(async ({ apiKeyId, data }) => {
    const apiKey = mockApiKeys.find((item) => item.id === apiKeyId);
    Object.assign(apiKey, data, { updatedAt: new Date('2026-06-01T01:00:00.000Z') });
    return apiKey;
  }),
}));

const app = require('../src/app');
const { signToken } = require('../src/utils/jwt');

const ownerToken = signToken({ sub: mockUsers[0].id });
const otherToken = signToken({ sub: mockUsers[1].id });

const authed = (method, path, token = ownerToken) => {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
};

describe('API key APIs', () => {
  beforeEach(() => {
    mockApiKeys.length = 0;
  });

  it('creates an API key and stores only the hash', async () => {
    const response = await authed('post', `/api/v1/projects/${mockProjects[0].id}/api-keys`).send({
      name: 'Production key',
    });

    const rawKey = response.body.data.key;

    expect(response.status).toBe(201);
    expect(rawKey).toMatch(/^flx_/);
    expect(response.body.data.apiKey).toMatchObject({
      projectId: mockProjects[0].id,
      name: 'Production key',
      status: 'ACTIVE',
    });
    expect(response.body.data.apiKey.keyHash).toBeUndefined();
    expect(mockApiKeys[0].keyHash).toBe(hashApiKey(rawKey));
    expect(mockApiKeys[0].keyHash).not.toBe(rawKey);
  });

  it('lists and gets masked API keys without raw keys or hashes', async () => {
    const createResponse = await authed('post', `/api/v1/projects/${mockProjects[0].id}/api-keys`).send({
      name: 'Readonly key',
    });
    const apiKeyId = createResponse.body.data.apiKey.id;

    const listResponse = await authed('get', `/api/v1/projects/${mockProjects[0].id}/api-keys`);
    const getResponse = await authed('get', `/api/v1/api-keys/${apiKeyId}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.apiKeys[0].maskedKey).toContain('********');
    expect(listResponse.body.data.apiKeys[0].keyHash).toBeUndefined();
    expect(listResponse.body.data.apiKeys[0].key).toBeUndefined();
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.apiKey.key).toBeUndefined();
    expect(getResponse.body.data.apiKey.keyHash).toBeUndefined();
  });

  it('revokes an owned API key', async () => {
    const createResponse = await authed('post', `/api/v1/projects/${mockProjects[0].id}/api-keys`).send({
      name: 'Temporary key',
    });
    const apiKeyId = createResponse.body.data.apiKey.id;

    const response = await authed('post', `/api/v1/api-keys/${apiKeyId}/revoke`);

    expect(response.status).toBe(200);
    expect(response.body.data.apiKey.status).toBe('REVOKED');
    expect(response.body.data.key).toBeUndefined();
  });

  it('rotates an owned API key and returns the new raw key only once', async () => {
    const createResponse = await authed('post', `/api/v1/projects/${mockProjects[0].id}/api-keys`).send({
      name: 'Rotating key',
    });
    const apiKeyId = createResponse.body.data.apiKey.id;
    const oldHash = mockApiKeys[0].keyHash;

    const rotateResponse = await authed('post', `/api/v1/api-keys/${apiKeyId}/rotate`);
    const getResponse = await authed('get', `/api/v1/api-keys/${apiKeyId}`);

    expect(rotateResponse.status).toBe(200);
    expect(rotateResponse.body.data.key).toMatch(/^flx_/);
    expect(mockApiKeys[0].keyHash).toBe(hashApiKey(rotateResponse.body.data.key));
    expect(mockApiKeys[0].keyHash).not.toBe(oldHash);
    expect(getResponse.body.data.apiKey.key).toBeUndefined();
    expect(getResponse.body.data.apiKey.keyHash).toBeUndefined();
  });

  it('blocks access to API keys from projects owned by another user', async () => {
    const createResponse = await authed('post', `/api/v1/projects/${mockProjects[0].id}/api-keys`).send({
      name: 'Private key',
    });
    const apiKeyId = createResponse.body.data.apiKey.id;

    const getResponse = await authed('get', `/api/v1/api-keys/${apiKeyId}`, otherToken);
    const listResponse = await authed('get', `/api/v1/projects/${mockProjects[0].id}/api-keys`, otherToken);

    expect(getResponse.status).toBe(404);
    expect(listResponse.status).toBe(404);
  });
});
