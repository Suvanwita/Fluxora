const { z } = require('zod');

const slugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and hyphens');

const projectIdParamsSchema = z.object({
  projectId: z.string().uuid(),
});

const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    slug: slugSchema,
    description: z.string().max(1000).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const listProjectsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const getProjectSchema = z.object({
  body: z.object({}).optional(),
  params: projectIdParamsSchema,
  query: z.object({}).optional(),
});

const updateProjectSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(120).optional(),
      slug: slugSchema.optional(),
      description: z.string().max(1000).nullable().optional(),
      status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one project field is required',
    }),
  params: projectIdParamsSchema,
  query: z.object({}).optional(),
});

module.exports = {
  createProjectSchema,
  getProjectSchema,
  listProjectsSchema,
  updateProjectSchema,
};
