const success = (res, data, statusCode = 200, meta) => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
};

const created = (res, data, meta) => {
  return success(res, data, 201, meta);
};

const noContent = (res) => {
  return res.status(204).send();
};

module.exports = {
  created,
  noContent,
  success,
};
