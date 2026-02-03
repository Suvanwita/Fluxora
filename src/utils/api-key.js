const { createHash, randomBytes, timingSafeEqual } = require('crypto');

const API_KEY_PREFIX = 'flx';
const API_KEY_BYTES = 32;

const generateApiKey = (prefix = API_KEY_PREFIX) => {
  const secret = randomBytes(API_KEY_BYTES).toString('base64url');
  const key = `${prefix}_${secret}`;
  const keyPrefix = key.slice(0, 12);

  return {
    key,
    keyPrefix,
  };
};

const hashApiKey = (apiKey) => {
  return createHash('sha256').update(apiKey).digest('hex');
};

const verifyApiKeyHash = (apiKey, expectedHash) => {
  const actualHash = hashApiKey(apiKey);
  const actual = Buffer.from(actualHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
};

module.exports = {
  generateApiKey,
  hashApiKey,
  verifyApiKeyHash,
};
