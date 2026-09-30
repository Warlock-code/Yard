import { Redis } from "@upstash/redis"

// Lazy Redis client — null when Upstash env vars are missing (e.g. local dev).
// Previously this file constructed `new Redis({ url: undefined, token: undefined })`
// at import time, so EVERY call to rateLimit()/rateLimitWithInfo() threw
// ("Failed to parse URL from /pipeline") and broke signup/login/etc with a 500.
let _redis: Redis | null | undefined
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    _redis = null
    return _redis
  }
  _redis = new Redis({ url, token })
  return _redis
}

// In-memory fallback for when Redis is not configured or unreachable.
// Single-process only, but keeps auth flows working instead of 500ing.
// Rate limiting must FAIL OPEN — never block signup/login because the limiter is down.
const mem = new Map<string, { count: number; expiresAt: number }>()

function memCheck(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const entry = mem.get(key)
  if (!entry || entry.expiresAt <= now) {
    mem.set(key, { count: 1, expiresAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs, count: 1 }
  }
  entry.count += 1
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.expiresAt, count: entry.count }
  }
  return { allowed: true, remaining: max - entry.count, resetAt: entry.expiresAt, count: entry.count }
}

export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const result = await rateLimitWithInfo(key, max, windowMs)
  return result.allowed
}

export async function rateLimitWithInfo(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const windowSec = Math.ceil(windowMs / 1000)
  const redisKey = `ratelimit:${key}`
  const redis = getRedis()

  if (!redis) {
    const m = memCheck(redisKey, max, windowMs)
    return { allowed: m.allowed, remaining: m.remaining, resetAt: m.resetAt }
  }

  try {
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
  } catch (err) {
    // Redis down — fail open via in-memory so signup/login never 500
    console.error("[rateLimit] redis failed, using memory fallback:", err instanceof Error ? err.message : err)
    const m = memCheck(redisKey, max, windowMs)
    return { allowed: m.allowed, remaining: m.remaining, resetAt: m.resetAt }
  }
}

export async function clearRateLimit(key: string) {
  mem.delete(`ratelimit:${key}`)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`ratelimit:${key}`)
  } catch (err) {
    console.error("[rateLimit] clear failed:", err instanceof Error ? err.message : err)
  }
}

export async function getRateLimitInfo(key: string, max: number, windowMs: number) {
  const redisKey = `ratelimit:${key}`
  const redis = getRedis()
  if (redis) {
    try {
      const current = await redis.get(redisKey)
      const count = typeof current === "number" ? current : 0
      const ttl = await redis.ttl(redisKey)
      return {
        count,
        remaining: Math.max(0, max - count),
        resetAt: Date.now() + (ttl > 0 ? ttl * 1000 : windowMs),
        allowed: count < max,
      }
    } catch (err) {
      console.error("[rateLimit] info failed, using memory fallback:", err instanceof Error ? err.message : err)
    }
  }
  const entry = mem.get(redisKey)
  const now = Date.now()
  const count = entry && entry.expiresAt > now ? entry.count : 0
  const resetAt = entry && entry.expiresAt > now ? entry.expiresAt : now + windowMs
  return {
    count,
    remaining: Math.max(0, max - count),
    resetAt,
    allowed: count < max,
  }
}