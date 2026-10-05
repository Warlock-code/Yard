import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const logLevels = process.env.NODE_ENV === "development" 
  ? ["query", "error", "warn"] as const
  : ["error"] as const

const prismaClientOptions = {
  log: [...logLevels],
  // Only override the datasource URL when it's actually set. Passing
  // `url: undefined` would clobber the URL resolved from prisma.config.ts
  // and make every query fail with a connection error (looks like "db down").
  ...(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : {}),
}

export const prisma = globalForPrisma.prisma || new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Neon (pooled) connections go cold when idle: the first query after sleep
// can fail with P1001/P1017/connector errors even though the DB is fine.
// Retry once after a short pause so signup/login/feed survive the wake-up.
const TRANSIENT_DB_PATTERNS = ["P1001", "P1002", "P1017", "P2024", "Timed out fetching", "Can't reach database", "Connection", "connector", "sleep", "idle"]

export function isDbConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? `${(err as { code?: unknown }).code ?? ""} ${err.message}` : String(err)
  return TRANSIENT_DB_PATTERNS.some((p) => msg.includes(p))
}

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (retries > 0 && isDbConnectionError(err)) {
      await new Promise((r) => setTimeout(r, 600))
      return fn()
    }
    throw err
  }
}