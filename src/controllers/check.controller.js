const checkService = require('../services/check.service');
const { asyncHandler } = require('../utils/async-handler');
const { success } = require('../utils/response');

const checkRequest = asyncHandler(async (req, res) => {
  const result = await checkService.checkRequest(req.body);

  return success(res, result);
});

module.exports = {
  checkRequest,
};
