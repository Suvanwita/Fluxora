process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fluxora_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_FALLBACK_MODE = 'fail_open';
process.env.LOG_LEVEL = 'dev';

const mockApplyFixedWindow = jest.fn();
const mockApplySlidingWindow = jest.fn();
const mockApplyTokenBucket = jest.fn();

jest.mock('../src/services/limiter.service', () => ({
  applyFixedWindow: (...args) => mockApplyFixedWindow(...args),
  applySlidingWindow: (...args) => mockApplySlidingWindow(...args),
  applyTokenBucket: (...args) => mockApplyTokenBucket(...args),
}));

const { consume } = require('../src/services/limiterFactory');

const baseInput = {
  identity: 'key_123:client_a:GET:_v1_users',
  endpoint: '/v1/users',
  requestId: 'req_123',
  now: new Date('2026-06-01T10:15:30.000Z'),
};

describe('limiter factory', () => {
  beforeEach(() => {
    mockApplyFixedWindow.mockReset();
    mockApplySlidingWindow.mockReset();
    mockApplyTokenBucket.mockReset();
  });

  it('routes fixed-window rules to the fixed-window limiter', async () => {
    mockApplyFixedWindow.mockResolvedValue({ allowed: true });
    const rule = { id: 'rule_1', algorithm: 'FIXED_WINDOW' };

    const result = await consume({ ...baseInput, rule });

    expect(result).toEqual({ allowed: true });
    expect(mockApplyFixedWindow).toHaveBeenCalledWith({ ...baseInput, rule });
    expect(mockApplySlidingWindow).not.toHaveBeenCalled();
    expect(mockApplyTokenBucket).not.toHaveBeenCalled();
  });

  it('routes sliding-window rules to the sliding-window limiter', async () => {
    mockApplySlidingWindow.mockResolvedValue({ allowed: false });
    const rule = { id: 'rule_2', algorithm: 'SLIDING_WINDOW' };

    const result = await consume({ ...baseInput, rule });

    expect(result).toEqual({ allowed: false });
    expect(mockApplySlidingWindow).toHaveBeenCalledWith({ ...baseInput, rule });
    expect(mockApplyFixedWindow).not.toHaveBeenCalled();
    expect(mockApplyTokenBucket).not.toHaveBeenCalled();
  });

  it('routes token-bucket rules to the token-bucket limiter', async () => {
    mockApplyTokenBucket.mockResolvedValue({ allowed: true, remaining: 3 });
    const rule = { id: 'rule_3', algorithm: 'TOKEN_BUCKET' };

    const result = await consume({ ...baseInput, rule, cost: 2 });

    expect(result).toEqual({ allowed: true, remaining: 3 });
    expect(mockApplyTokenBucket).toHaveBeenCalledWith({ ...baseInput, rule, cost: 2 });
    expect(mockApplyFixedWindow).not.toHaveBeenCalled();
    expect(mockApplySlidingWindow).not.toHaveBeenCalled();
  });
});
