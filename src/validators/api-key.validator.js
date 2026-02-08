const { z } = require('zod');

const projectIdParamsSchema = z.object({
  projectId: z.string().uuid(),
});

const apiKeyIdParamsSchema = z.object({
  apiKeyId: z.string().uuid(),
});

const createApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    expiresAt: z.string().datetime().optional(),
  }),
  params: projectIdParamsSchema,
  query: z.object({}).optional(),
});

const listApiKeysSchema = z.object({
  body: z.object({}).optional(),
  params: projectIdParamsSchema,
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const getApiKeySchema = z.object({
  body: z.object({}).optional(),
  params: apiKeyIdParamsSchema,
  query: z.object({}).optional(),
});

module.exports = {
  createApiKeySchema,
  getApiKeySchema,
  listApiKeysSchema,
};
