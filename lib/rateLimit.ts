const WINDOW_MS = 60 * 1000

const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const record = hits.get(key)

  if (!record || now > record.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= max) {
    return false
  }

  record.count++
  return true
}

export function rateLimitWithInfo(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const record = hits.get(key)

  if (!record || now > record.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs }
  }

  if (record.count >= max) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: max - record.count, resetAt: record.resetAt }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, record] of hits.entries()) {
    if (now > record.resetAt) {
      hits.delete(key)
    }
  }
}, WINDOW_MS)