const projectService = require('../services/project.service');
const { asyncHandler } = require('../utils/async-handler');
const { created, noContent, success } = require('../utils/response');

const createProject = asyncHandler(async (req, res) => {
  const result = await projectService.createProject({
    userId: req.user.id,
    data: req.body,
  });

  return created(res, result);
});

const listProjects = asyncHandler(async (req, res) => {
  const result = await projectService.listProjects({
    userId: req.user.id,
    query: req.query,
  });

  return success(res, { projects: result.projects }, 200, result.meta);
});

const getProjectById = asyncHandler(async (req, res) => {
  const result = await projectService.getProjectById({
    userId: req.user.id,
    projectId: req.params.projectId,
  });

  return success(res, result);
});

const updateProject = asyncHandler(async (req, res) => {
  const result = await projectService.updateProject({
    userId: req.user.id,
    projectId: req.params.projectId,
    data: req.body,
  });

  return success(res, result);
});

const deleteProject = asyncHandler(async (req, res) => {
  await projectService.deleteProject({
    userId: req.user.id,
    projectId: req.params.projectId,
  });

  return noContent(res);
});

module.exports = {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
};
