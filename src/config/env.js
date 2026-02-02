const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1, 'JWT_EXPIRES_IN is required'),
  PORT: z
    .string({ required_error: 'PORT is required' })
    .regex(/^\d+$/, 'PORT must be a positive integer')
    .transform(Number)
    .pipe(z.number().int().positive('PORT must be a positive integer')),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  RATE_LIMIT_FALLBACK_MODE: z.enum(['allow', 'deny']),
  LOG_LEVEL: z.enum(['combined', 'common', 'dev', 'short', 'tiny']),
  CORS_ORIGIN: z.string().default('*'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${issues}`);
}

/**
 * @typedef {z.infer<typeof envSchema>} EnvConfig
 */

/** @type {Readonly<EnvConfig>} */
const config = Object.freeze(parsedEnv.data);

module.exports = {
  config,
  env: config,
};
