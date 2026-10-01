import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { reportServerError } from "@/lib/errorAlerts"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    })
  } catch (error) {
    void reportServerError({ route: "/api/health", error })
    return NextResponse.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 503 })
  }
}