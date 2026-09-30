import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prismaClientOptions = {
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] as const : ["error"] as const,
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
}

export const prisma = globalForPrisma.prisma || new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// For serverless environments, we can also use the Prisma Data Proxy
// or connection pooling via PgBouncer
// Example for PgBouncer: add ?pgbouncer=true to DATABASE_URL
// Or use Prisma Accelerate: @prisma/extension-accelerate