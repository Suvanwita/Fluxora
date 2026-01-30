const { ApiError } = require('../utils/api-error');

const notFoundHandler = (req, res, next) => {
  return next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

module.exports = {
  notFoundHandler,
};
