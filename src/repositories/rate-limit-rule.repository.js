const { prisma } = require('../config/db');

const createRateLimitRule = ({ projectId, data }) => {
  return prisma.rateLimitRule.create({
    data: {
      projectId,
      ...data,
    },
  });
};

const countRateLimitRulesByProject = (projectId) => {
  return prisma.rateLimitRule.count({
    where: { projectId },
  });
};

const listRateLimitRulesByProject = ({ projectId, skip, take }) => {
  return prisma.rateLimitRule.findMany({
    where: { projectId },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    skip,
    take,
  });
};

const findRateLimitRuleByIdForOwner = ({ ruleId, ownerId }) => {
  return prisma.rateLimitRule.findFirst({
    where: {
      id: ruleId,
      project: {
        ownerId,
        status: {
          not: 'DELETED',
        },
      },
    },
  });
};

const updateRateLimitRule = ({ ruleId, data }) => {
  return prisma.rateLimitRule.update({
    where: { id: ruleId },
    data,
  });
};

const deleteRateLimitRule = (ruleId) => {
  return prisma.rateLimitRule.delete({
    where: { id: ruleId },
  });
};

module.exports = {
  countRateLimitRulesByProject,
  createRateLimitRule,
  deleteRateLimitRule,
  findRateLimitRuleByIdForOwner,
  listRateLimitRulesByProject,
  updateRateLimitRule,
};
