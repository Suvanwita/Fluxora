const apiKeyRepository = require('../repositories/api-key.repository');
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

const checkRequest = async ({ apiKey: rawApiKey, endpoint, method, clientId, requestId }) => {
  const apiKey = await validateApiKey(rawApiKey);
  const ruleMatch = await matchRateLimitRule({
    apiKey,
    endpoint,
    method,
    clientId,
  });
  const rule = ruleMatch.rule;
  const { runLimiter } = require('./limiter.service');
  const limiterResult = await runLimiter({
    rule,
    apiKey,
    endpoint,
    method,
    clientId,
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
  checkRequest,
  validateApiKey,
};
