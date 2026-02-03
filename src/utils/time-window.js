const toUnixSeconds = (date = new Date()) => {
  return Math.floor(date.getTime() / 1000);
};

const getFixedWindow = (windowSeconds, date = new Date()) => {
  const now = toUnixSeconds(date);
  const start = Math.floor(now / windowSeconds) * windowSeconds;
  const end = start + windowSeconds;

  return {
    start,
    end,
    ttlSeconds: Math.max(end - now, 0),
  };
};

const getSlidingWindow = (windowSeconds, date = new Date()) => {
  const end = toUnixSeconds(date);
  const start = end - windowSeconds;

  return {
    start,
    end,
    ttlSeconds: windowSeconds,
  };
};

const getDailyWindow = (date = new Date()) => {
  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  return {
    start: startDate,
    end: endDate,
    date: startDate,
  };
};

module.exports = {
  getDailyWindow,
  getFixedWindow,
  getSlidingWindow,
  toUnixSeconds,
};
