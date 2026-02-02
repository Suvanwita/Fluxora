const IORedis = require('ioredis');

const { env } = require('./env');
const { logger } = require('../utils/logger');

const globalForRedis = global;

const redis =
  globalForRedis.redis ||
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

if (!globalForRedis.redis) {
  redis.on('connect', () => {
    logger.info('Redis connection established');
  });

  redis.on('ready', () => {
    logger.info('Redis connection ready');
  });

  redis.on('error', (error) => {
    logger.error('Redis connection error', error);
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });
}

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

const disconnectRedis = async () => {
  if (redis.status === 'end') {
    return;
  }

  try {
    if (redis.status === 'ready') {
      await redis.quit();
    } else {
      redis.disconnect();
    }
  } catch (error) {
    logger.error('Failed to gracefully disconnect Redis client', error);
    redis.disconnect();
  }
};

module.exports = {
  redis,
  disconnectRedis,
};
