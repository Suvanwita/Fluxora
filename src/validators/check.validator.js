const { z } = require('zod');

const checkSchema = z.object({
  body: z.object({
    apiKey: z.string().min(1),
    endpoint: z.string().min(1).max(500),
    method: z.string().min(1).max(16).transform((method) => method.toUpperCase()),
    clientId: z.string().min(1).max(200).optional(),
    requestId: z.string().min(1).max(200).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = {
  checkSchema,
};
