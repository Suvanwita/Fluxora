const { success } = require('../utils/response');

const getHealth = (req, res) => {
  return success(res, {
    status: 'ok',
    service: 'fluxora',
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  getHealth,
};
