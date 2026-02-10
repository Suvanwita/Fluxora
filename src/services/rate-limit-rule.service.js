const apiKeyRepository = require('../repositories/api-key.repository');
const projectRepository = require('../repositories/project.repository');
const rateLimitRuleRepository = require('../repositories/rate-limit-rule.repository');
const { ApiError } = require('../utils/api-error');
const { matchEndpointPattern } = require('../utils/endpoint-matcher');
const { getPagination, getPaginationMeta } = require('../utils/pagination');

const DEFAULT_PROJECT_RULE = Object.freeze({
  id: null,
  name: 'Default project rule',
  scope: 'PROJECT',
  algorithm: 'FIXED_WINDOW',
  limit: 1000,
  windowSeconds: 60,
  refillRate: null,
  burstCapacity: null,
  endpointPattern: null,
  priority: 0,
  enabled: true,
  metadata: {
    default: true,
  },
});

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

const normalizeMethod = (method) => {
  return method ? method.toUpperCase() : undefined;
};

const toArray = (value) => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const metadataMatches = ({ metadata, method, clientId }) => {
  if (!metadata) {
    return true;
  }

  const allowedMethods = toArray(metadata.methods || metadata.method || metadata.httpMethods).map(normalizeMethod);
  const allowedClientIds = toArray(metadata.clientIds || metadata.clientId);

  if (allowedMethods.length > 0 && !allowedMethods.includes(normalizeMethod(method))) {
    return false;
  }

  if (allowedClientIds.length > 0 && !allowedClientIds.includes(clientId)) {
    return false;
  }

  return true;
};

const ruleMatchesRequest = ({ rule, apiKey, endpoint, method, clientId }) => {
  if (rule.apiKeyId && rule.apiKeyId !== apiKey.id) {
    return false;
  }

  if (rule.endpointPattern && !matchEndpointPattern(rule.endpointPattern, endpoint)) {
    return false;
  }

  return metadataMatches({ metadata: rule.metadata, method, clientId });
};

const sortRulesByPriority = (rules) => {
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
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

const getDefaultProjectRule = ({ projectId }) => ({
  ...DEFAULT_PROJECT_RULE,
  projectId,
  apiKeyId: null,
  isDefault: true,
});

const matchRateLimitRule = async ({ apiKey, endpoint, method, clientId }) => {
  if (!apiKey?.id || !apiKey?.projectId) {
    throw new ApiError(400, 'API key with id and projectId is required');
  }

  const rules = await rateLimitRuleRepository.listEnabledRulesForApiKeyAndProject({
    apiKeyId: apiKey.id,
    projectId: apiKey.projectId,
  });
  const matchingRule = sortRulesByPriority(rules).find((rule) =>
    ruleMatchesRequest({ rule, apiKey, endpoint, method, clientId }),
  );

  if (!matchingRule) {
    return {
      rule: getDefaultProjectRule({ projectId: apiKey.projectId }),
      matched: false,
      source: 'default',
    };
  }

  return {
    rule: toRuleResponse(matchingRule),
    matched: true,
    source: 'custom',
  };
};

module.exports = {
  createRateLimitRule,
  deleteRateLimitRule,
  listRateLimitRules,
  matchRateLimitRule,
  setRateLimitRuleEnabled,
  updateRateLimitRule,
  ruleMatchesRequest,
};
