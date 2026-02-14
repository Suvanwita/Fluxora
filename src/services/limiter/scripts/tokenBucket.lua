local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttlSeconds = tonumber(ARGV[5])

local state = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(state[1])
local lastRefill = tonumber(state[2])

if tokens == nil then
  tokens = capacity
end

if lastRefill == nil then
  lastRefill = now
end

local elapsed = math.max(now - lastRefill, 0)
tokens = math.min(capacity, tokens + (elapsed * refillRate))

local allowed = 0
if tokens >= cost then
  allowed = 1
  tokens = tokens - cost
end

local retryAfter = 0
if allowed == 0 then
  retryAfter = math.ceil((cost - tokens) / refillRate)
end

local resetAfter = math.ceil((capacity - tokens) / refillRate)
local resetAt = now + resetAfter

redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
redis.call('EXPIRE', key, ttlSeconds)

return {
  allowed,
  tokens,
  retryAfter,
  resetAt
}
