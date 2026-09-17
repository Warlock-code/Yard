const buckets = new Map<string, number[]>()

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const recent = (buckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs)
  if (recent.length >= max) {
    buckets.set(key, recent)
    return false
  }

  recent.push(now)
  buckets.set(key, recent)
  return true
}
