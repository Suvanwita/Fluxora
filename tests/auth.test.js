process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'fail_open';
process.env.LOG_LEVEL = 'dev';

const request = require('supertest');

const users = [];

jest.mock('../src/repositories/auth.repository', () => ({
  createUser: jest.fn(async ({ email, passwordHash, name }) => {
    const user = {
      id: `user_${users.length + 1}`,
      email,
      passwordHash,
      name,
      role: 'MEMBER',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };

    users.push(user);
    return user;
  }),
  findUserByEmail: jest.fn(async (email) => {
    return users.find((user) => user.email === email) || null;
  }),
  findUserById: jest.fn(async (id) => {
    return users.find((user) => user.id === id) || null;
  }),
}));

const app = require('../src/app');

describe('auth APIs', () => {
  beforeEach(() => {
    users.length = 0;
  });

  it('registers a user', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'ada@example.com',
      password: 'super-secret-password',
      name: 'Ada',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.user).toMatchObject({
      id: 'user_1',
      email: 'ada@example.com',
      name: 'Ada',
      role: 'MEMBER',
    });
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it('logs in and returns the current user', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'grace@example.com',
      password: 'super-secret-password',
      name: 'Grace',
    });

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'grace@example.com',
      password: 'super-secret-password',
    });

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`);

    expect(loginResponse.status).toBe(200);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user).toMatchObject({
      id: 'user_1',
      email: 'grace@example.com',
    });
  });

  it('rejects invalid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'linus@example.com',
      password: 'super-secret-password',
      name: 'Linus',
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'linus@example.com',
      password: 'wrong-password',
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
