const { prisma } = require('../config/db');

const ACTIVE_PROJECT_WHERE = {
  status: {
    not: 'DELETED',
  },
};

const createProject = ({ ownerId, name, slug, description }) => {
  return prisma.project.create({
    data: {
      ownerId,
      name,
      slug,
      description,
    },
  });
};

const countProjectsByOwner = (ownerId) => {
  return prisma.project.count({
    where: {
      ownerId,
      ...ACTIVE_PROJECT_WHERE,
    },
  });
};

const listProjectsByOwner = ({ ownerId, skip, take }) => {
  return prisma.project.findMany({
    where: {
      ownerId,
      ...ACTIVE_PROJECT_WHERE,
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip,
    take,
  });
};

const findProjectByIdAndOwner = ({ id, ownerId }) => {
  return prisma.project.findFirst({
    where: {
      id,
      ownerId,
      ...ACTIVE_PROJECT_WHERE,
    },
  });
};

const findProjectBySlug = (slug) => {
  return prisma.project.findUnique({
    where: { slug },
  });
};

const updateProjectByIdAndOwner = ({ id, ownerId, data }) => {
  return prisma.project.updateMany({
    where: {
      id,
      ownerId,
      ...ACTIVE_PROJECT_WHERE,
    },
    data,
  });
};

const softDeleteProjectByIdAndOwner = ({ id, ownerId }) => {
  return prisma.project.updateMany({
    where: {
      id,
      ownerId,
      ...ACTIVE_PROJECT_WHERE,
    },
    data: {
      status: 'DELETED',
    },
  });
};

module.exports = {
  countProjectsByOwner,
  createProject,
  findProjectByIdAndOwner,
  findProjectBySlug,
  listProjectsByOwner,
  softDeleteProjectByIdAndOwner,
  updateProjectByIdAndOwner,
};
