const { prisma } = require('../config/db');

const createApiKey = ({ projectId, name, keyPrefix, keyHash, expiresAt }) => {
  return prisma.apiKey.create({
    data: {
      projectId,
      name,
      keyPrefix,
      keyHash,
      expiresAt,
    },
  });
};

const listApiKeysByProject = ({ projectId, skip, take }) => {
  return prisma.apiKey.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
};

const countApiKeysByProject = (projectId) => {
  return prisma.apiKey.count({
    where: { projectId },
  });
};

const findApiKeyByIdForOwner = ({ apiKeyId, ownerId }) => {
  return prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      project: {
        ownerId,
        status: {
          not: 'DELETED',
        },
      },
    },
  });
};

const updateApiKey = ({ apiKeyId, data }) => {
  return prisma.apiKey.update({
    where: { id: apiKeyId },
    data,
  });
};

module.exports = {
  countApiKeysByProject,
  createApiKey,
  findApiKeyByIdForOwner,
  listApiKeysByProject,
  updateApiKey,
};
