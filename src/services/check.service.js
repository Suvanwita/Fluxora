const apiKeyRepository = require('../repositories/api-key.repository');
const { env } = require('../config/env');
const { ApiError } = require('../utils/api-error');
const { hashApiKey } = require('../utils/api-key');
const { logger } = require('../utils/logger');
const { matchRateLimitRule } = require('./rate-limit-rule.service');

const validateApiKey = async (rawApiKey) => {
  const keyHash = hashApiKey(rawApiKey);
  const apiKey = await apiKeyRepository.findApiKeyByHash(keyHash);

  if (!apiKey) {
    throw new ApiError(401, 'Invalid API key');
  }

  if (apiKey.status !== 'ACTIVE') {
    throw new ApiError(401, 'API key is not active');
  }

  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
    throw new ApiError(401, 'API key has expired');
  }

  if (!apiKey.project || apiKey.project.status === 'DELETED') {
    throw new ApiError(404, 'Project not found');
  }

  return apiKey;
};

const enqueueRequestLog = async ({ apiKey, endpoint, method, requestId, decision, limiterResult, rule }) => {
  try {
    const { logsQueue } = require('../queues/logs.queue');

    await logsQueue.add('request-log', {
      apiKeyId: apiKey.id,
      projectId: apiKey.projectId,
      requestId,
      endpoint,
      method,
      decision,
      ruleId: rule.id,
      algorithm: rule.algorithm,
      remaining: limiterResult.remaining,
      resetAt: limiterResult.resetAt,
      retryAfter: limiterResult.retryAfter,
      reason: limiterResult.reason,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to enqueue request log', error);
  }
};

const buildRedisFallbackDecision = ({ error, rule }) => {
  const retryAfter = rule.windowSeconds || 60;
  const resetAt = new Date(Date.now() + retryAfter * 1000).toISOString();
  const isFailOpen = env.RATE_LIMIT_FALLBACK_MODE === 'fail_open';
  const decision = isFailOpen
    ? {
        allowed: true,
        remaining: rule.limit,
        resetAt,
        retryAfter: 0,
        reason: 'redis_unavailable_fail_open',
      }
    : {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
        reason: 'redis_unavailable_fail_closed',
      };

  logger.warn('Rate limit fallback decision applied', {
    mode: env.RATE_LIMIT_FALLBACK_MODE,
    ruleId: rule.id,
    algorithm: rule.algorithm,
    allowed: decision.allowed,
    reason: decision.reason,
    error: error.message,
  });

  return decision;
};

const consumeLimiterWithFallback = async ({ rule, identity, endpoint, requestId }) => {
  const { consume } = require('./limiterFactory');

  try {
    return await consume({
      rule,
      identity,
      endpoint,
      requestId,
    });
  } catch (error) {
    return buildRedisFallbackDecision({ error, rule });
  }
};

const checkRequest = async ({ apiKey: rawApiKey, endpoint, method, clientId, requestId }) => {
  const apiKey = await validateApiKey(rawApiKey);
  const ruleMatch = await matchRateLimitRule({
    apiKey,
    endpoint,
    method,
    clientId,
  });
  const rule = ruleMatch.rule;
  const { buildIdentity } = require('./limiter.service');
  const identity = buildIdentity({
    apiKeyId: apiKey.id,
    endpoint,
    method,
    clientId,
  });
  const limiterResult = await consumeLimiterWithFallback({
    rule,
    identity,
    endpoint,
    requestId,
  });
  const decision = limiterResult.allowed ? 'ALLOWED' : 'THROTTLED';

  await Promise.all([
    apiKeyRepository.updateApiKey({
      apiKeyId: apiKey.id,
      data: {
        lastUsedAt: new Date(),
      },
    }),
    enqueueRequestLog({
      apiKey,
      endpoint,
      method,
      requestId,
      decision,
      limiterResult,
      rule,
    }),
  ]);

  return {
    allowed: limiterResult.allowed,
    algorithm: rule.algorithm,
    limit: rule.limit,
    remaining: limiterResult.remaining,
    resetAt: limiterResult.resetAt,
    retryAfter: limiterResult.retryAfter,
    ruleId: rule.id,
    reason: limiterResult.reason,
  };
};

module.exports = {
  buildRedisFallbackDecision,
  checkRequest,
  consumeLimiterWithFallback,
  validateApiKey,
};
