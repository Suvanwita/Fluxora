const { generateRequestId } = require('../utils/request-id');

const requestId = (req, res, next) => {
  const id = req.get('x-request-id') || generateRequestId();

  req.id = id;
  res.setHeader('x-request-id', id);

  return next();
};

module.exports = {
  requestId,
};
