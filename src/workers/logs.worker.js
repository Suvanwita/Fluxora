const { Worker } = require('bullmq');

const { redis } = require('../config/redis');
const { logger } = require('../utils/logger');

const logsWorker = new Worker(
  'logs',
  async (job) => {
    logger.info(`Processing logs job ${job.id}`, job.data);
  },
  { connection: redis },
);

logsWorker.on('failed', (job, error) => {
  logger.error(`Logs job ${job?.id} failed`, error);
});

logger.info('Logs worker started');

module.exports = {
  logsWorker,
};
