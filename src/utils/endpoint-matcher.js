const escapeRegex = (value) => {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
};

const patternToRegex = (pattern) => {
  if (pattern === '*') {
    return /^.*$/;
  }

  const source = pattern
    .split('/')
    .map((part) => {
      if (part === '*') {
        return '[^/]+';
      }

      if (part === '**') {
        return '.*';
      }

      if (part.startsWith(':')) {
        return '[^/]+';
      }

      return escapeRegex(part);
    })
    .join('/');

  return new RegExp(`^${source}$`);
};

const normalizeEndpoint = (endpoint) => {
  if (!endpoint || endpoint === '/') {
    return '/';
  }

  return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
};

const matchEndpointPattern = (pattern, endpoint) => {
  const regex = patternToRegex(normalizeEndpoint(pattern));
  return regex.test(normalizeEndpoint(endpoint));
};

module.exports = {
  matchEndpointPattern,
  patternToRegex,
};
