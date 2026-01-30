const { ApiError } = require('../utils/api-error');

const errorHandler = (error, req, res, next) => {
  const isKnownError = error instanceof ApiError;
  const statusCode = isKnownError ? error.statusCode : 500;
  const message = isKnownError ? error.message : 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(isKnownError && error.details ? { details: error.details } : {}),
    },
  });
};

module.exports = {
  errorHandler,
};
