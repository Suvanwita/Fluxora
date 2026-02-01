const { prisma } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

async function main() {
  logger.info('No seed data configured');
}

main()
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
