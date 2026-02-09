const router = require('express').Router();

const {
  deleteRateLimitRule,
  disableRateLimitRule,
  enableRateLimitRule,
  updateRateLimitRule,
} = require('../controllers/rate-limit-rule.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  getRateLimitRuleSchema,
  updateRateLimitRuleSchema,
} = require('../validators/rate-limit-rule.validator');

router.use(authenticate);

router.patch('/:ruleId', validate(updateRateLimitRuleSchema), updateRateLimitRule);
router.post('/:ruleId/enable', validate(getRateLimitRuleSchema), enableRateLimitRule);
router.post('/:ruleId/disable', validate(getRateLimitRuleSchema), disableRateLimitRule);
router.delete('/:ruleId', validate(getRateLimitRuleSchema), deleteRateLimitRule);

module.exports = router;
