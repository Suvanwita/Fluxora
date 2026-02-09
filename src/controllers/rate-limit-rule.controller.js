const rateLimitRuleService = require('../services/rate-limit-rule.service');
const { asyncHandler } = require('../utils/async-handler');
const { created, noContent, success } = require('../utils/response');

const createRateLimitRule = asyncHandler(async (req, res) => {
  const result = await rateLimitRuleService.createRateLimitRule({
    userId: req.user.id,
    projectId: req.params.projectId,
    data: req.body,
  });

  return created(res, result);
});

const listRateLimitRules = asyncHandler(async (req, res) => {
  const result = await rateLimitRuleService.listRateLimitRules({
    userId: req.user.id,
    projectId: req.params.projectId,
    query: req.query,
  });

  return success(res, { rules: result.rules }, 200, result.meta);
});

const updateRateLimitRule = asyncHandler(async (req, res) => {
  const result = await rateLimitRuleService.updateRateLimitRule({
    userId: req.user.id,
    ruleId: req.params.ruleId,
    data: req.body,
  });

  return success(res, result);
});

const enableRateLimitRule = asyncHandler(async (req, res) => {
  const result = await rateLimitRuleService.setRateLimitRuleEnabled({
    userId: req.user.id,
    ruleId: req.params.ruleId,
    enabled: true,
  });

  return success(res, result);
});

const disableRateLimitRule = asyncHandler(async (req, res) => {
  const result = await rateLimitRuleService.setRateLimitRuleEnabled({
    userId: req.user.id,
    ruleId: req.params.ruleId,
    enabled: false,
  });

  return success(res, result);
});

const deleteRateLimitRule = asyncHandler(async (req, res) => {
  await rateLimitRuleService.deleteRateLimitRule({
    userId: req.user.id,
    ruleId: req.params.ruleId,
  });

  return noContent(res);
});

module.exports = {
  createRateLimitRule,
  deleteRateLimitRule,
  disableRateLimitRule,
  enableRateLimitRule,
  listRateLimitRules,
  updateRateLimitRule,
};
