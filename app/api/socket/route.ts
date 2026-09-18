import { NextRequest, NextResponse } from "next/server"
import { Server as HTTPServer } from "http"
import { Server } from "socket.io"
import { initializeSocket } from "@/server/socket"

let ioInstance: ReturnType<typeof initializeSocket> | null = null

export async function GET(req: NextRequest) {
  if (!ioInstance) {
    const httpServer = new HTTPServer()
    ioInstance = initializeSocket(httpServer)
  }

  return new NextResponse(null, { status: 200 })
}

export const dynamic = "force-dynamic"