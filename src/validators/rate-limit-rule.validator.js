const { z } = require('zod');

const algorithmSchema = z.enum(['FIXED_WINDOW', 'SLIDING_WINDOW', 'TOKEN_BUCKET']);

const projectIdParamsSchema = z.object({
  projectId: z.string().uuid(),
});

const ruleIdParamsSchema = z.object({
  ruleId: z.string().uuid(),
});

const metadataSchema = z.record(z.any()).optional();

const createRateLimitRuleSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    apiKeyId: z.string().uuid().optional(),
    algorithm: algorithmSchema,
    limit: z.number().int().positive(),
    windowSeconds: z.number().int().positive(),
    refillRate: z.number().int().positive().optional(),
    burstCapacity: z.number().int().positive().optional(),
    endpointPattern: z.string().min(1).max(500).optional(),
    priority: z.number().int().min(0).default(100),
    enabled: z.boolean().default(true),
    metadata: metadataSchema,
  }),
  params: projectIdParamsSchema,
  query: z.object({}).optional(),
});

const listRateLimitRulesSchema = z.object({
  body: z.object({}).optional(),
  params: projectIdParamsSchema,
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const updateRateLimitRuleSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(120).optional(),
      apiKeyId: z.string().uuid().nullable().optional(),
      algorithm: algorithmSchema.optional(),
      limit: z.number().int().positive().optional(),
      windowSeconds: z.number().int().positive().optional(),
      refillRate: z.number().int().positive().nullable().optional(),
      burstCapacity: z.number().int().positive().nullable().optional(),
      endpointPattern: z.string().min(1).max(500).nullable().optional(),
      priority: z.number().int().min(0).optional(),
      enabled: z.boolean().optional(),
      metadata: z.record(z.any()).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one rule field is required',
    }),
  params: ruleIdParamsSchema,
  query: z.object({}).optional(),
});

const getRateLimitRuleSchema = z.object({
  body: z.object({}).optional(),
  params: ruleIdParamsSchema,
  query: z.object({}).optional(),
});

module.exports = {
  createRateLimitRuleSchema,
  getRateLimitRuleSchema,
  listRateLimitRulesSchema,
  updateRateLimitRuleSchema,
};
