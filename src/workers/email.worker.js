const { Worker } = require('bullmq');

const { redis } = require('../config/redis');
const { logger } = require('../utils/logger');

const emailWorker = new Worker(
  'email',
  async (job) => {
    logger.info(`Processing email job ${job.id}`, job.data);
  },
  { connection: redis },
);

emailWorker.on('failed', (job, error) => {
  logger.error(`Email job ${job?.id} failed`, error);
});

module.exports = {
  emailWorker,
};
