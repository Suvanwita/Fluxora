const { ApiError } = require('../utils/api-error');

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!result.success) {
    return next(new ApiError(400, 'Validation failed', result.error.flatten()));
  }

  req.body = result.data.body;
  req.params = result.data.params;
  req.query = result.data.query;
  return next();
};

module.exports = {
  validate,
};
