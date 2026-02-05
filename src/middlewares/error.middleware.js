const { ApiError } = require('../utils/api-error');
const { logger } = require('../utils/logger');

const isProduction = () => process.env.NODE_ENV === 'production';

const formatZodErrors = (error) => {
  if (typeof error.flatten === 'function') {
    return error.flatten();
  }

  return {
    fieldErrors: error.issues?.reduce((acc, issue) => {
      const key = issue.path.join('.') || 'root';
      acc[key] = acc[key] || [];
      acc[key].push(issue.message);
      return acc;
    }, {}),
  };
};

const formatApiErrorDetails = (details) => {
  if (!details) {
    return undefined;
  }

  if (details.fieldErrors || details.formErrors) {
    return details;
  }

  return details;
};

const getPrismaKnownError = (error) => {
  if (error.code === 'P2002') {
    return {
      statusCode: 409,
      code: 'DUPLICATE_KEY',
      message: 'Resource already exists',
      details: {
        fields: error.meta?.target || [],
      },
    };
  }

  if (error.code === 'P2025') {
    return {
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
    };
  }

  if (error.code === 'P2003') {
    return {
      statusCode: 409,
      code: 'FOREIGN_KEY_CONSTRAINT',
      message: 'Related resource constraint failed',
      details: {
        field: error.meta?.field_name,
      },
    };
  }

  if (typeof error.code === 'string' && /^P\d{4}$/.test(error.code)) {
    return {
      statusCode: 400,
      code: 'DATABASE_ERROR',
      message: 'Database request failed',
    };
  }

  return null;
};

const getDuplicateKeyError = (error) => {
  if (error.code === '23505' || error.code === 11000) {
    return {
      statusCode: 409,
      code: 'DUPLICATE_KEY',
      message: 'Resource already exists',
      details: {
        constraint: error.constraint,
        fields: Object.keys(error.keyValue || {}),
      },
    };
  }

  return null;
};

const normalizeError = (error) => {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      code: error.code || 'API_ERROR',
      message: error.message,
      details: formatApiErrorDetails(error.details),
    };
  }

  if (error.name === 'ZodError') {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: formatZodErrors(error),
    };
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: error.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token',
    };
  }

  const prismaError = getPrismaKnownError(error);

  if (prismaError) {
    return prismaError;
  }

  const duplicateKeyError = getDuplicateKeyError(error);

  if (duplicateKeyError) {
    return duplicateKeyError;
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  };
};

const errorHandler = (error, req, res, next) => {
  const normalizedError = normalizeError(error);
  const responseError = {
    message: normalizedError.message,
    code: normalizedError.code,
    ...(normalizedError.details ? { details: normalizedError.details } : {}),
    ...(req.id ? { requestId: req.id } : {}),
    ...(!isProduction() && error.stack ? { stack: error.stack } : {}),
  };

  if (normalizedError.statusCode >= 500) {
    logger.error(error);
  }

  return res.status(normalizedError.statusCode).json({
    success: false,
    error: responseError,
  });
};

module.exports = {
  errorHandler,
  normalizeError,
};
