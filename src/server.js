const app = require('./app');
const { prisma } = require('./config/database');
const { redis } = require('./config/redis');
const { env } = require('./config/env');
const { logger } = require('./utils/logger');

const server = app.listen(env.PORT, () => {
  logger.info(`Fluxora API listening on port ${env.PORT}`);
});

const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down HTTP server`);

  server.close(async () => {
    logger.info('HTTP server closed');
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
