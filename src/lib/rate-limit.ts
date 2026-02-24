import { getRedis } from "./redis"

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redisKey = `rate-limit:${key}`
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - windowSeconds

  const redis = getRedis()
  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(redisKey, 0, windowStart)
  pipeline.zadd(redisKey, now, `${now}:${Math.random()}`)
  pipeline.zcard(redisKey)
  pipeline.expire(redisKey, windowSeconds)

  const results = await pipeline.exec()
  const currentCount = (results?.[2]?.[1] as number) || 0

  return {
    allowed: currentCount <= maxRequests,
    remaining: Math.max(0, maxRequests - currentCount),
    resetInSeconds: windowSeconds,
  }
}

export async function rateLimitByIp(
  ip: string,
  endpoint: string,
  maxRequests = 60,
  windowSeconds = 60
): Promise<RateLimitResult> {
  return rateLimit(`${endpoint}:${ip}`, maxRequests, windowSeconds)
}

export async function rateLimitByUser(
  userId: string,
  endpoint: string,
  maxRequests = 120,
  windowSeconds = 60
): Promise<RateLimitResult> {
  return rateLimit(`${endpoint}:user:${userId}`, maxRequests, windowSeconds)
}
