const { readFileSync } = require('fs');
const { join } = require('path');

const { redis } = require('../config/redis');
const { getFixedWindow, getSlidingWindow, toUnixSeconds } = require('../utils/time-window');

const tokenBucketScript = readFileSync(
  join(__dirname, 'limiter', 'scripts', 'tokenBucket.lua'),
  'utf8',
);

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

const buildSlidingWindowKey = ({ ruleId, projectId, identity }) => {
  return `fluxora:rl:sliding:${getRuleKeyId({ ruleId, projectId })}:${identity}`;
};

const buildTokenBucketKey = ({ ruleId, projectId, identity }) => {
  return `fluxora:rl:token:${getRuleKeyId({ ruleId, projectId })}:${identity}`;
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

const resolveIdentity = ({ identity, apiKey, endpoint, method, clientId }) => {
  return (
    identity ||
    buildIdentity({
      apiKeyId: apiKey.id,
      endpoint,
      method,
      clientId,
    })
  );
};

const applyFixedWindow = async ({ rule, identity, apiKey, endpoint, method, clientId, now }) => {
  const window = getFixedWindow(rule.windowSeconds, now);
  const limiterIdentity = resolveIdentity({ identity, apiKey, endpoint, method, clientId });
  const key = buildFixedWindowKey({
    ruleId: rule.id,
    projectId: rule.projectId || apiKey.projectId,
    identity: limiterIdentity,
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

const applySlidingWindow = async ({ rule, identity, apiKey, endpoint, method, clientId, requestId, now }) => {
  const window = getSlidingWindow(rule.windowSeconds, now);
  const nowMs = now.getTime();
  const limiterIdentity = resolveIdentity({ identity, apiKey, endpoint, method, clientId });
  const key = buildSlidingWindowKey({
    ruleId: rule.id,
    projectId: rule.projectId || apiKey.projectId,
    identity: limiterIdentity,
  });
  const member = `${nowMs}:${requestId || Math.random()}`;

  await redis.zremrangebyscore(key, 0, window.start * 1000);

  const activeCount = await redis.zcard(key);
  const allowed = activeCount < rule.limit;
  const currentCount = allowed ? activeCount + 1 : activeCount;

  if (allowed) {
    await redis.zadd(key, nowMs, member);
  }

  await redis.expire(key, rule.windowSeconds);

  const remaining = Math.max(rule.limit - currentCount, 0);
  const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
  const oldestMs = oldest[1] ? Number(oldest[1]) : nowMs;
  const resetAtMs = oldestMs + rule.windowSeconds * 1000;
  const retryAfter = allowed ? 0 : Math.max(Math.ceil((resetAtMs - nowMs) / 1000), 0);

  return {
    allowed,
    remaining,
    resetAt: new Date(resetAtMs).toISOString(),
    retryAfter,
    currentCount,
    reason: allowed ? 'allowed' : 'rate_limit_exceeded',
  };
};

const applyTokenBucket = async ({ rule, identity, apiKey, endpoint, method, clientId, now, cost = 1 }) => {
  const capacity = rule.burstCapacity || rule.limit;
  const refillRate = rule.refillRate || rule.limit / rule.windowSeconds;
  const nowSeconds = toUnixSeconds(now);
  const limiterIdentity = resolveIdentity({ identity, apiKey, endpoint, method, clientId });
  const key = buildTokenBucketKey({
    ruleId: rule.id,
    projectId: rule.projectId || apiKey.projectId,
    identity: limiterIdentity,
  });
  const ttlSeconds = Math.max(Math.ceil(capacity / refillRate) * 2, rule.windowSeconds, 1);
  const result = await redis.eval(tokenBucketScript, 1, key, capacity, refillRate, nowSeconds, cost, ttlSeconds);
  const allowed = Number(result[0]) === 1;
  const remaining = Math.max(Math.floor(Number(result[1])), 0);
  const retryAfter = Number(result[2]);
  const resetAtSeconds = Number(result[3]);

  return {
    allowed,
    remaining,
    resetAt: new Date(resetAtSeconds * 1000).toISOString(),
    retryAfter,
    currentCount: capacity - remaining,
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
    return applySlidingWindow({
      rule,
      apiKey,
      endpoint,
      method,
      clientId,
      requestId,
      now,
    });
  }

  if (rule.algorithm === 'TOKEN_BUCKET') {
    return applyTokenBucket({
      rule,
      apiKey,
      endpoint,
      method,
      clientId,
      now,
      cost: 1,
    });
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
  applySlidingWindow,
  applyTokenBucket,
  buildFixedWindowKey,
  buildIdentity,
  buildLimiterKey,
  buildSlidingWindowKey,
  buildTokenBucketKey,
  resolveIdentity,
  runLimiter,
};
