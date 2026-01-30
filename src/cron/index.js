const { logger } = require('../utils/logger');

const startCronJobs = () => {
  logger.info('No cron jobs registered');
};

module.exports = {
  startCronJobs,
};
