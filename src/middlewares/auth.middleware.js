const authService = require('../services/auth.service');
const { ApiError } = require('../utils/api-error');
const { verifyToken } = require('../utils/jwt');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }

    const token = header.slice('Bearer '.length);
    const payload = verifyToken(token);

    req.user = await authService.findAuthUser(payload.sub);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  authenticate,
};
