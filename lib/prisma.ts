import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const logLevels = process.env.NODE_ENV === "development" 
  ? ["query", "error", "warn"] as const
  : ["error"] as const

const prismaClientOptions = {
  log: logLevels,
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
}

export const prisma = globalForPrisma.prisma || new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma