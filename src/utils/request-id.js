const { randomUUID } = require('crypto');

const generateRequestId = () => {
  return randomUUID();
};

module.exports = {
  generateRequestId,
};
