const router = require('express').Router();

const {
  getApiKeyById,
  revokeApiKey,
  rotateApiKey,
} = require('../controllers/api-key.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { getApiKeySchema } = require('../validators/api-key.validator');

router.use(authenticate);

router.get('/:apiKeyId', validate(getApiKeySchema), getApiKeyById);
router.post('/:apiKeyId/revoke', validate(getApiKeySchema), revokeApiKey);
router.post('/:apiKeyId/rotate', validate(getApiKeySchema), rotateApiKey);

module.exports = router;
