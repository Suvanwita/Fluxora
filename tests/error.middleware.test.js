process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'allow';
process.env.LOG_LEVEL = 'dev';

const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { errorHandler, normalizeError } = require('../src/middlewares/error.middleware');
const { ApiError } = require('../src/utils/api-error');

const createResponse = () => {
  const res = {};

  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);

  return res;
};

describe('error middleware', () => {
  it('formats validation errors', () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: 'bad' });
    const normalized = normalizeError(result.error);

    expect(normalized).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
    });
    expect(normalized.details.fieldErrors.email).toContain('Invalid email');
  });

  it('formats ApiError details', () => {
    const normalized = normalizeError(new ApiError(403, 'Forbidden', { reason: 'nope' }));

    expect(normalized).toMatchObject({
      statusCode: 403,
      code: 'API_ERROR',
      message: 'Forbidden',
      details: { reason: 'nope' },
    });
  });

  it('formats Prisma duplicate-key errors', () => {
    const normalized = normalizeError({
      code: 'P2002',
      meta: { target: ['email'] },
    });

    expect(normalized).toEqual({
      statusCode: 409,
      code: 'DUPLICATE_KEY',
      message: 'Resource already exists',
      details: { fields: ['email'] },
    });
  });

  it('formats database duplicate-key errors', () => {
    const normalized = normalizeError({
      code: '23505',
      constraint: 'users_email_key',
    });

    expect(normalized).toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_KEY',
      message: 'Resource already exists',
      details: { constraint: 'users_email_key' },
    });
  });

  it('formats JWT errors', () => {
    const normalized = normalizeError(new jwt.JsonWebTokenError('jwt malformed'));

    expect(normalized).toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid token',
    });
  });

  it('formats unknown server errors without leaking stack traces in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';

    const req = { id: 'req_123' };
    const res = createResponse();
    const error = new Error('Database password is hunter2');

    errorHandler(error, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: 'req_123',
      },
    });

    process.env.NODE_ENV = previousNodeEnv;
    consoleError.mockRestore();
  });
});
