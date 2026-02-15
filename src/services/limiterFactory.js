const {
  applyFixedWindow,
  applySlidingWindow,
  applyTokenBucket,
} = require('./limiter.service');

const consume = ({ rule, identity, endpoint, requestId, now = new Date(), cost = 1 }) => {
  const input = {
    rule,
    identity,
    endpoint,
    requestId,
    now,
  };

  if (rule.algorithm === 'SLIDING_WINDOW') {
    return applySlidingWindow(input);
  }

  if (rule.algorithm === 'TOKEN_BUCKET') {
    return applyTokenBucket({
      ...input,
      cost,
    });
  }

  return applyFixedWindow(input);
};

module.exports = {
  consume,
};
