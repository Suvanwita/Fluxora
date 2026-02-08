const apiKeyService = require('../services/api-key.service');
const { asyncHandler } = require('../utils/async-handler');
const { created, success } = require('../utils/response');

const createApiKey = asyncHandler(async (req, res) => {
  const result = await apiKeyService.createApiKey({
    userId: req.user.id,
    projectId: req.params.projectId,
    data: req.body,
  });

  return created(res, result);
});

const listApiKeys = asyncHandler(async (req, res) => {
  const result = await apiKeyService.listApiKeys({
    userId: req.user.id,
    projectId: req.params.projectId,
    query: req.query,
  });

  return success(res, { apiKeys: result.apiKeys }, 200, result.meta);
});

const getApiKeyById = asyncHandler(async (req, res) => {
  const result = await apiKeyService.getApiKeyById({
    userId: req.user.id,
    apiKeyId: req.params.apiKeyId,
  });

  return success(res, result);
});

const revokeApiKey = asyncHandler(async (req, res) => {
  const result = await apiKeyService.revokeApiKey({
    userId: req.user.id,
    apiKeyId: req.params.apiKeyId,
  });

  return success(res, result);
});

const rotateApiKey = asyncHandler(async (req, res) => {
  const result = await apiKeyService.rotateApiKey({
    userId: req.user.id,
    apiKeyId: req.params.apiKeyId,
  });

  return success(res, result);
});

module.exports = {
  createApiKey,
  getApiKeyById,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
};
