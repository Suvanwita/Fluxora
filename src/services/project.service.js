const projectRepository = require('../repositories/project.repository');
const { ApiError } = require('../utils/api-error');
const { getPagination, getPaginationMeta } = require('../utils/pagination');

const toProjectResponse = (project) => ({
  id: project.id,
  name: project.name,
  slug: project.slug,
  description: project.description,
  ownerId: project.ownerId,
  status: project.status,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

const ensureSlugAvailable = async (slug, currentProjectId) => {
  const existingProject = await projectRepository.findProjectBySlug(slug);

  if (existingProject && existingProject.id !== currentProjectId) {
    throw new ApiError(409, 'Project slug is already in use', {
      fieldErrors: {
        slug: ['Project slug is already in use'],
      },
    });
  }
};

const createProject = async ({ userId, data }) => {
  await ensureSlugAvailable(data.slug);

  const project = await projectRepository.createProject({
    ownerId: userId,
    name: data.name,
    slug: data.slug,
    description: data.description,
  });

  return {
    project: toProjectResponse(project),
  };
};

const listProjects = async ({ userId, query }) => {
  const pagination = getPagination(query);
  const [total, projects] = await Promise.all([
    projectRepository.countProjectsByOwner(userId),
    projectRepository.listProjectsByOwner({
      ownerId: userId,
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return {
    projects: projects.map(toProjectResponse),
    meta: getPaginationMeta({ ...pagination, total }),
  };
};

const getProjectById = async ({ userId, projectId }) => {
  const project = await projectRepository.findProjectByIdAndOwner({
    id: projectId,
    ownerId: userId,
  });

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  return {
    project: toProjectResponse(project),
  };
};

const updateProject = async ({ userId, projectId, data }) => {
  const project = await projectRepository.findProjectByIdAndOwner({
    id: projectId,
    ownerId: userId,
  });

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (data.slug) {
    await ensureSlugAvailable(data.slug, projectId);
  }

  await projectRepository.updateProjectByIdAndOwner({
    id: projectId,
    ownerId: userId,
    data,
  });

  return getProjectById({ userId, projectId });
};

const deleteProject = async ({ userId, projectId }) => {
  const result = await projectRepository.softDeleteProjectByIdAndOwner({
    id: projectId,
    ownerId: userId,
  });

  if (result.count === 0) {
    throw new ApiError(404, 'Project not found');
  }
};

module.exports = {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
};
