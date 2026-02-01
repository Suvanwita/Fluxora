const { Queue } = require('bullmq');

const { redis } = require('../config/redis');

const logsQueue = new Queue('logs', {
  connection: redis,
});

module.exports = {
  logsQueue,
};
