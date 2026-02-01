const { Queue } = require('bullmq');

const { redis } = require('../config/redis');

const analyticsQueue = new Queue('analytics', {
  connection: redis,
});

module.exports = {
  analyticsQueue,
};
