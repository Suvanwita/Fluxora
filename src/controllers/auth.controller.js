const authService = require('../services/auth.service');
const { success } = require('../utils/response');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return success(res, result, 201);
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return success(res, result);
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res) => {
  return success(res, { user: req.user });
};

module.exports = {
  register,
  login,
  me,
};
