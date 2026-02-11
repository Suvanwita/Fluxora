const { redis } = require('../config/redis');
const { getFixedWindow, getSlidingWindow, toUnixSeconds } = require('../utils/time-window');

const buildLimiterKey = ({ algorithm, apiKeyId, ruleId, projectId, endpoint, method, clientId }) => {
  const targetId = ruleId || `default:${projectId}`;
  const parts = ['ratelimit', algorithm, targetId, apiKeyId, method, endpoint, clientId || 'anonymous'];

  return parts.map((part) => String(part).replace(/\s+/g, '_')).join(':');
};

const toResetDate = (unixSeconds) => {
  return new Date(unixSeconds * 1000).toISOString();
};

const applyFixedWindow = async ({ rule, key, now }) => {
  const window = getFixedWindow(rule.windowSeconds, now);
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, window.ttlSeconds);
  }

  const remaining = Math.max(rule.limit - count, 0);
  const allowed = count <= rule.limit;

  return {
    allowed,
    remaining,
    resetAt: toResetDate(window.end),
    retryAfter: allowed ? 0 : window.ttlSeconds,
    reason: allowed ? 'allowed' : 'rate_limit_exceeded',
  };
};

const applySlidingWindow = async ({ rule, key, now }) => {
  const window = getSlidingWindow(rule.windowSeconds, now);
  const nowMs = now.getTime();
  const member = `${nowMs}:${Math.random()}`;

  await redis.zremrangebyscore(key, 0, window.start * 1000);
  await redis.zadd(key, nowMs, member);
  await redis.expire(key, rule.windowSeconds);

  const count = await redis.zcard(key);
  const remaining = Math.max(rule.limit - count, 0);
  const allowed = count <= rule.limit;
  const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
  const oldestMs = oldest[1] ? Number(oldest[1]) : nowMs;
  const resetAtMs = oldestMs + rule.windowSeconds * 1000;
  const retryAfter = allowed ? 0 : Math.max(Math.ceil((resetAtMs - nowMs) / 1000), 0);

  return {
    allowed,
    remaining,
    resetAt: new Date(resetAtMs).toISOString(),
    retryAfter,
    reason: allowed ? 'allowed' : 'rate_limit_exceeded',
  };
};

const applyTokenBucket = async ({ rule, key, now }) => {
  const capacity = rule.burstCapacity || rule.limit;
  const refillRate = rule.refillRate || rule.limit / rule.windowSeconds;
  const nowSeconds = toUnixSeconds(now);
  const currentValue = await redis.get(key);
  const current = currentValue ? JSON.parse(currentValue) : { tokens: capacity, updatedAt: nowSeconds };
  const elapsed = Math.max(nowSeconds - current.updatedAt, 0);
  const tokens = Math.min(capacity, current.tokens + elapsed * refillRate);
  const allowed = tokens >= 1;
  const nextTokens = allowed ? tokens - 1 : tokens;
  const retryAfter = allowed ? 0 : Math.ceil((1 - nextTokens) / refillRate);
  const resetSeconds = allowed
    ? Math.ceil((capacity - nextTokens) / refillRate)
    : retryAfter;

  await redis.set(
    key,
    JSON.stringify({
      tokens: nextTokens,
      updatedAt: nowSeconds,
    }),
    'EX',
    Math.max(rule.windowSeconds * 2, 1),
  );

  return {
    allowed,
    remaining: Math.floor(nextTokens),
    resetAt: new Date((nowSeconds + resetSeconds) * 1000).toISOString(),
    retryAfter,
    reason: allowed ? 'allowed' : 'rate_limit_exceeded',
  };
};

const runLimiter = async ({ rule, apiKey, endpoint, method, clientId, requestId, now = new Date() }) => {
  const key = buildLimiterKey({
    algorithm: rule.algorithm,
    apiKeyId: apiKey.id,
    ruleId: rule.id,
    projectId: apiKey.projectId,
    endpoint,
    method,
    clientId,
    requestId,
  });
  const input = { rule, key, now };

  if (rule.algorithm === 'SLIDING_WINDOW') {
    return applySlidingWindow(input);
  }

  if (rule.algorithm === 'TOKEN_BUCKET') {
    return applyTokenBucket(input);
  }

  return applyFixedWindow(input);
};

module.exports = {
  buildLimiterKey,
  runLimiter,
};
