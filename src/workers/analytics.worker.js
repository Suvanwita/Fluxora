const { Worker } = require('bullmq');

const { redis } = require('../config/redis');
const { logger } = require('../utils/logger');

const analyticsWorker = new Worker(
  'analytics',
  async (job) => {
    logger.info(`Processing analytics job ${job.id}`, job.data);
  },
  { connection: redis },
);

analyticsWorker.on('failed', (job, error) => {
  logger.error(`Analytics job ${job?.id} failed`, error);
});

logger.info('Analytics worker started');

module.exports = {
  analyticsWorker,
};
