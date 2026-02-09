const apiKeyRepository = require('../repositories/api-key.repository');
const projectRepository = require('../repositories/project.repository');
const rateLimitRuleRepository = require('../repositories/rate-limit-rule.repository');
const { ApiError } = require('../utils/api-error');
const { getPagination, getPaginationMeta } = require('../utils/pagination');

const toRuleResponse = (rule) => ({
  id: rule.id,
  projectId: rule.projectId,
  apiKeyId: rule.apiKeyId,
  name: rule.name,
  scope: rule.scope,
  algorithm: rule.algorithm,
  limit: rule.limit,
  windowSeconds: rule.windowSeconds,
  refillRate: rule.refillRate,
  burstCapacity: rule.burstCapacity,
  endpointPattern: rule.endpointPattern,
  priority: rule.priority,
  enabled: rule.enabled,
  metadata: rule.metadata,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt,
});

const inferScope = ({ apiKeyId, endpointPattern }) => {
  if (apiKeyId) {
    return 'API_KEY';
  }

  if (endpointPattern) {
    return 'ENDPOINT';
  }

  return 'PROJECT';
};

const ensureProjectOwner = async ({ projectId, userId }) => {
  const project = await projectRepository.findProjectByIdAndOwner({
    id: projectId,
    ownerId: userId,
  });

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  return project;
};

const ensureApiKeyOwnerForProject = async ({ apiKeyId, projectId, userId }) => {
  if (!apiKeyId) {
    return;
  }

  const apiKey = await apiKeyRepository.findApiKeyByIdForOwner({
    apiKeyId,
    ownerId: userId,
  });

  if (!apiKey || apiKey.projectId !== projectId) {
    throw new ApiError(404, 'API key not found');
  }
};

const getOwnedRule = async ({ ruleId, userId }) => {
  const rule = await rateLimitRuleRepository.findRateLimitRuleByIdForOwner({
    ruleId,
    ownerId: userId,
  });

  if (!rule) {
    throw new ApiError(404, 'Rate limit rule not found');
  }

  return rule;
};

const normalizeRuleData = (data) => ({
  name: data.name,
  apiKeyId: data.apiKeyId,
  scope: inferScope(data),
  algorithm: data.algorithm,
  limit: data.limit,
  windowSeconds: data.windowSeconds,
  refillRate: data.refillRate,
  burstCapacity: data.burstCapacity,
  endpointPattern: data.endpointPattern,
  priority: data.priority,
  enabled: data.enabled,
  metadata: data.metadata,
});

const createRateLimitRule = async ({ userId, projectId, data }) => {
  await ensureProjectOwner({ projectId, userId });
  await ensureApiKeyOwnerForProject({ apiKeyId: data.apiKeyId, projectId, userId });

  const rule = await rateLimitRuleRepository.createRateLimitRule({
    projectId,
    data: normalizeRuleData(data),
  });

  return {
    rule: toRuleResponse(rule),
  };
};

const listRateLimitRules = async ({ userId, projectId, query }) => {
  await ensureProjectOwner({ projectId, userId });

  const pagination = getPagination(query);
  const [total, rules] = await Promise.all([
    rateLimitRuleRepository.countRateLimitRulesByProject(projectId),
    rateLimitRuleRepository.listRateLimitRulesByProject({
      projectId,
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return {
    rules: rules.map(toRuleResponse),
    meta: getPaginationMeta({ ...pagination, total }),
  };
};

const updateRateLimitRule = async ({ userId, ruleId, data }) => {
  const existingRule = await getOwnedRule({ ruleId, userId });
  const nextProjectId = existingRule.projectId;
  const nextApiKeyId = data.apiKeyId === undefined ? existingRule.apiKeyId : data.apiKeyId;
  const nextEndpointPattern =
    data.endpointPattern === undefined ? existingRule.endpointPattern : data.endpointPattern;

  await ensureApiKeyOwnerForProject({
    apiKeyId: nextApiKeyId,
    projectId: nextProjectId,
    userId,
  });

  const rule = await rateLimitRuleRepository.updateRateLimitRule({
    ruleId,
    data: {
      ...data,
      scope: inferScope({
        apiKeyId: nextApiKeyId,
        endpointPattern: nextEndpointPattern,
      }),
    },
  });

  return {
    rule: toRuleResponse(rule),
  };
};

const setRateLimitRuleEnabled = async ({ userId, ruleId, enabled }) => {
  await getOwnedRule({ ruleId, userId });

  const rule = await rateLimitRuleRepository.updateRateLimitRule({
    ruleId,
    data: { enabled },
  });

  return {
    rule: toRuleResponse(rule),
  };
};

const deleteRateLimitRule = async ({ userId, ruleId }) => {
  await getOwnedRule({ ruleId, userId });
  await rateLimitRuleRepository.deleteRateLimitRule(ruleId);
};

module.exports = {
  createRateLimitRule,
  deleteRateLimitRule,
  listRateLimitRules,
  setRateLimitRuleEnabled,
  updateRateLimitRule,
};
