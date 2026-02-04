const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/async-handler');
const { ApiError } = require('../utils/api-error');
const { verifyToken } = require('../utils/jwt');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required');
  }

  let payload;

  try {
    const token = header.slice('Bearer '.length);
    payload = verifyToken(token);
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  if (!payload.sub) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  req.user = await authService.findAuthUser(payload.sub);
  return next();
});

module.exports = {
  authenticate,
};
