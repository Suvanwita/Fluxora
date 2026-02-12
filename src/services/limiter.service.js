const { redis } = require('../config/redis');
const { getFixedWindow, getSlidingWindow, toUnixSeconds } = require('../utils/time-window');

const sanitizeKeyPart = (part) => {
  return String(part || 'none').replace(/[^a-zA-Z0-9:_-]/g, '_');
};

const buildIdentity = ({ apiKeyId, endpoint, method, clientId }) => {
  return [apiKeyId, clientId || 'anonymous', method, endpoint].map(sanitizeKeyPart).join(':');
};

const getRuleKeyId = ({ ruleId, projectId }) => {
  return sanitizeKeyPart(ruleId || `default:${projectId}`);
};

const buildFixedWindowKey = ({ ruleId, projectId, identity, windowStart }) => {
  return `fluxora:rl:fixed:${getRuleKeyId({ ruleId, projectId })}:${identity}:${windowStart}`;
};

const buildLimiterKey = ({ algorithm, apiKeyId, ruleId, projectId, endpoint, method, clientId }) => {
  const targetId = getRuleKeyId({ ruleId, projectId });
  const identity = buildIdentity({ apiKeyId, endpoint, method, clientId });
  const normalizedAlgorithm = sanitizeKeyPart(algorithm).toLowerCase();

  return `fluxora:rl:${normalizedAlgorithm}:${targetId}:${identity}`;
};

const toResetDate = (unixSeconds) => {
  return new Date(unixSeconds * 1000).toISOString();
};

const applyFixedWindow = async ({ rule, apiKey, endpoint, method, clientId, now }) => {
  const window = getFixedWindow(rule.windowSeconds, now);
  const identity = buildIdentity({
    apiKeyId: apiKey.id,
    endpoint,
    method,
    clientId,
  });
  const key = buildFixedWindowKey({
    ruleId: rule.id,
    projectId: apiKey.projectId,
    identity,
    windowStart: window.start,
  });
  const currentCount = await redis.incr(key);

  if (currentCount === 1) {
    await redis.expire(key, window.ttlSeconds);
  }

  const remaining = Math.max(rule.limit - currentCount, 0);
  const allowed = currentCount <= rule.limit;

  return {
    allowed,
    remaining,
    resetAt: toResetDate(window.end),
    retryAfter: allowed ? 0 : window.ttlSeconds,
    currentCount,
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

  return applyFixedWindow({
    rule,
    apiKey,
    endpoint,
    method,
    clientId,
    now,
  });
};

module.exports = {
  applyFixedWindow,
  buildFixedWindowKey,
  buildIdentity,
  buildLimiterKey,
  runLimiter,
};
