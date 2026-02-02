const { PrismaClient } = require('@prisma/client');

const { logger } = require('../utils/logger');

const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const disconnectDb = async () => {
  try {
    await prisma.$disconnect();
    logger.info('Prisma connection closed');
  } catch (error) {
    logger.error('Failed to disconnect Prisma client', error);
  }
};

module.exports = {
  prisma,
  disconnectDb,
};
