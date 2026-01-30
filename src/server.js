const app = require('./app');
const { env } = require('./config/env');
const { logger } = require('./utils/logger');

const server = app.listen(env.PORT, () => {
  logger.info(`Fluxora API listening on port ${env.PORT}`);
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down HTTP server`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
