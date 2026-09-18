import { NextRequest, NextResponse } from "next/server"

export function requestSizeLimit(maxBytes: number) {
  return async function middleware(req: NextRequest, next: () => Promise<NextResponse>) {
    const contentLength = req.headers.get("content-length")
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }
    return next()
  }
}

export const apiRequestSizeLimit = requestSizeLimit(1024 * 1024) // 1MB for API routes
export const uploadRequestSizeLimit = requestSizeLimit(10 * 1024 * 1024) // 10MB for uploads