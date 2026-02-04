const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/async-handler');
const { success } = require('../utils/response');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return success(res, result, 201);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return success(res, result);
});

const getMe = asyncHandler(async (req, res) => {
  return success(res, { user: req.user });
});

module.exports = {
  getMe,
  register,
  login,
};
