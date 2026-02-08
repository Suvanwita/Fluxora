const router = require('express').Router();

const {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
} = require('../controllers/project.controller');
const { createApiKey, listApiKeys } = require('../controllers/api-key.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { createApiKeySchema, listApiKeysSchema } = require('../validators/api-key.validator');
const {
  createProjectSchema,
  getProjectSchema,
  listProjectsSchema,
  updateProjectSchema,
} = require('../validators/project.validator');

router.use(authenticate);

router.post('/', validate(createProjectSchema), createProject);
router.get('/', validate(listProjectsSchema), listProjects);
router.post('/:projectId/api-keys', validate(createApiKeySchema), createApiKey);
router.get('/:projectId/api-keys', validate(listApiKeysSchema), listApiKeys);
router.get('/:projectId', validate(getProjectSchema), getProjectById);
router.patch('/:projectId', validate(updateProjectSchema), updateProject);
router.delete('/:projectId', validate(getProjectSchema), deleteProject);

module.exports = router;
