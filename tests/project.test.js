process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'allow';
process.env.LOG_LEVEL = 'dev';

const request = require('supertest');

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
const mockProjects = [];

jest.mock('../src/repositories/auth.repository', () => ({
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(async (id) => {
    return mockUsers.find((user) => user.id === id) || null;
  }),
}));

jest.mock('../src/repositories/project.repository', () => ({
  countProjectsByOwner: jest.fn(async (ownerId) => {
    return mockProjects.filter((project) => project.ownerId === ownerId && project.status !== 'DELETED').length;
  }),
  createProject: jest.fn(async ({ ownerId, name, slug, description }) => {
    const project = {
      id: `00000000-0000-4000-8000-${String(mockProjects.length + 1).padStart(12, '0')}`,
      ownerId,
      name,
      slug,
      description,
      status: 'ACTIVE',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };

    mockProjects.push(project);
    return project;
  }),
  findProjectByIdAndOwner: jest.fn(async ({ id, ownerId }) => {
    return (
      mockProjects.find(
        (project) => project.id === id && project.ownerId === ownerId && project.status !== 'DELETED',
      ) || null
    );
  }),
  findProjectBySlug: jest.fn(async (slug) => {
    return mockProjects.find((project) => project.slug === slug) || null;
  }),
  listProjectsByOwner: jest.fn(async ({ ownerId, skip, take }) => {
    return mockProjects
      .filter((project) => project.ownerId === ownerId && project.status !== 'DELETED')
      .slice(skip, skip + take);
  }),
  softDeleteProjectByIdAndOwner: jest.fn(async ({ id, ownerId }) => {
    const project = mockProjects.find(
      (item) => item.id === id && item.ownerId === ownerId && item.status !== 'DELETED',
    );

    if (!project) {
      return { count: 0 };
    }

    project.status = 'DELETED';
    project.updatedAt = new Date('2026-06-01T01:00:00.000Z');
    return { count: 1 };
  }),
  updateProjectByIdAndOwner: jest.fn(async ({ id, ownerId, data }) => {
    const project = mockProjects.find(
      (item) => item.id === id && item.ownerId === ownerId && item.status !== 'DELETED',
    );

    if (!project) {
      return { count: 0 };
    }

    Object.assign(project, data, { updatedAt: new Date('2026-06-01T01:00:00.000Z') });
    return { count: 1 };
  }),
}));

const app = require('../src/app');
const { signToken } = require('../src/utils/jwt');

const ownerToken = signToken({ sub: mockUsers[0].id });
const otherToken = signToken({ sub: mockUsers[1].id });

const authed = (method, path, token = ownerToken) => {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
};

describe('project APIs', () => {
  beforeEach(() => {
    mockProjects.length = 0;
  });

  it('creates and lists projects for the authenticated owner', async () => {
    const createResponse = await authed('post', '/api/v1/projects').send({
      name: 'Core API',
      slug: 'core-api',
      description: 'Primary API project',
    });

    const listResponse = await authed('get', '/api/v1/projects');

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.project).toMatchObject({
      name: 'Core API',
      slug: 'core-api',
      description: 'Primary API project',
      ownerId: mockUsers[0].id,
      status: 'ACTIVE',
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.projects).toHaveLength(1);
    expect(listResponse.body.meta.total).toBe(1);
  });

  it('gets and updates only owned projects', async () => {
    const createResponse = await authed('post', '/api/v1/projects').send({
      name: 'Billing',
      slug: 'billing',
    });
    const projectId = createResponse.body.data.project.id;

    const forbiddenResponse = await authed('get', `/api/v1/projects/${projectId}`, otherToken);
    const updateResponse = await authed('patch', `/api/v1/projects/${projectId}`).send({
      name: 'Billing API',
      status: 'ARCHIVED',
    });

    expect(forbiddenResponse.status).toBe(404);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.project).toMatchObject({
      id: projectId,
      name: 'Billing API',
      status: 'ARCHIVED',
    });
  });

  it('soft-deletes owned projects and hides them from reads', async () => {
    const createResponse = await authed('post', '/api/v1/projects').send({
      name: 'Logs',
      slug: 'logs',
    });
    const projectId = createResponse.body.data.project.id;

    const deleteResponse = await authed('delete', `/api/v1/projects/${projectId}`);
    const getResponse = await authed('get', `/api/v1/projects/${projectId}`);
    const listResponse = await authed('get', '/api/v1/projects');

    expect(deleteResponse.status).toBe(204);
    expect(getResponse.status).toBe(404);
    expect(listResponse.body.data.projects).toHaveLength(0);
    expect(mockProjects[0].status).toBe('DELETED');
  });

  it('rejects duplicate slugs', async () => {
    await authed('post', '/api/v1/projects').send({
      name: 'Gateway',
      slug: 'gateway',
    });

    const response = await authed('post', '/api/v1/projects').send({
      name: 'Gateway Clone',
      slug: 'gateway',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.details.fieldErrors.slug).toContain('Project slug is already in use');
  });
});
