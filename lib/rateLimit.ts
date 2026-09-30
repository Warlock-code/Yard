import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const result = await rateLimitWithInfo(key, max, windowMs)
  return result.allowed
}

export async function rateLimitWithInfo(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const windowSec = Math.ceil(windowMs / 1000)
  const redisKey = `ratelimit:${key}`

  const current = await redis.incr(redisKey)

  if (current === 1) {
    await redis.expire(redisKey, windowSec)
  }

  if (current > max) {
    const ttl = await redis.ttl(redisKey)
    return { allowed: false, remaining: 0, resetAt: now + (ttl > 0 ? ttl * 1000 : windowMs) }
  }

  const ttl = await redis.ttl(redisKey)
  return { allowed: true, remaining: max - current, resetAt: now + (ttl > 0 ? ttl * 1000 : windowMs) }
}

export async function clearRateLimit(key: string) {
  await redis.del(`ratelimit:${key}`)
}

export async function getRateLimitInfo(key: string, max: number, windowMs: number) {
  const redisKey = `ratelimit:${key}`
  const current = await redis.get(redisKey)
  const count = typeof current === "number" ? current : 0
  const ttl = await redis.ttl(redisKey)
  return {
    count,
    remaining: Math.max(0, max - count),
    resetAt: Date.now() + (ttl > 0 ? ttl * 1000 : windowMs),
    allowed: count < max,
  }
}