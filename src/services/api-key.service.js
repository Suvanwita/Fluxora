const apiKeyRepository = require('../repositories/api-key.repository');
const projectRepository = require('../repositories/project.repository');
const { ApiError } = require('../utils/api-error');
const { generateApiKey, hashApiKey } = require('../utils/api-key');
const { getPagination, getPaginationMeta } = require('../utils/pagination');

const maskApiKey = (apiKey) => {
  return `${apiKey.keyPrefix}${'*'.repeat(20)}`;
};

const toApiKeyResponse = (apiKey) => ({
  id: apiKey.id,
  projectId: apiKey.projectId,
  name: apiKey.name,
  keyPrefix: apiKey.keyPrefix,
  maskedKey: maskApiKey(apiKey),
  status: apiKey.status,
  expiresAt: apiKey.expiresAt,
  lastUsedAt: apiKey.lastUsedAt,
  createdAt: apiKey.createdAt,
  updatedAt: apiKey.updatedAt,
});

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

const getOwnedApiKey = async ({ apiKeyId, userId }) => {
  const apiKey = await apiKeyRepository.findApiKeyByIdForOwner({
    apiKeyId,
    ownerId: userId,
  });

  if (!apiKey) {
    throw new ApiError(404, 'API key not found');
  }

  return apiKey;
};

const createApiKey = async ({ userId, projectId, data }) => {
  await ensureProjectOwner({ projectId, userId });

  const { key, keyPrefix } = generateApiKey();
  const apiKey = await apiKeyRepository.createApiKey({
    projectId,
    name: data.name,
    keyPrefix,
    keyHash: hashApiKey(key),
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
  });

  return {
    apiKey: toApiKeyResponse(apiKey),
    key,
  };
};

const listApiKeys = async ({ userId, projectId, query }) => {
  await ensureProjectOwner({ projectId, userId });

  const pagination = getPagination(query);
  const [total, apiKeys] = await Promise.all([
    apiKeyRepository.countApiKeysByProject(projectId),
    apiKeyRepository.listApiKeysByProject({
      projectId,
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return {
    apiKeys: apiKeys.map(toApiKeyResponse),
    meta: getPaginationMeta({ ...pagination, total }),
  };
};

const getApiKeyById = async ({ userId, apiKeyId }) => {
  const apiKey = await getOwnedApiKey({ userId, apiKeyId });

  return {
    apiKey: toApiKeyResponse(apiKey),
  };
};

const revokeApiKey = async ({ userId, apiKeyId }) => {
  const apiKey = await getOwnedApiKey({ userId, apiKeyId });

  if (apiKey.status === 'REVOKED') {
    return {
      apiKey: toApiKeyResponse(apiKey),
    };
  }

  const revokedApiKey = await apiKeyRepository.updateApiKey({
    apiKeyId,
    data: {
      status: 'REVOKED',
    },
  });

  return {
    apiKey: toApiKeyResponse(revokedApiKey),
  };
};

const rotateApiKey = async ({ userId, apiKeyId }) => {
  await getOwnedApiKey({ userId, apiKeyId });

  const { key, keyPrefix } = generateApiKey();
  const apiKey = await apiKeyRepository.updateApiKey({
    apiKeyId,
    data: {
      keyPrefix,
      keyHash: hashApiKey(key),
      status: 'ACTIVE',
    },
  });

  return {
    apiKey: toApiKeyResponse(apiKey),
    key,
  };
};

module.exports = {
  createApiKey,
  getApiKeyById,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
};
