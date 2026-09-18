import { NextResponse } from "next/server"

const ALLOWED_ORIGINS = process.env.NODE_ENV === "production"
  ? ["https://yardapp.me", "https://www.yardapp.me"]
  : ["http://localhost:3000", "http://127.0.0.1:3000", "http://10.0.2.2:3000"]

export function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin)
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  }
}

export function handleCors(req: Request) {
  const origin = req.headers.get("origin")
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    })
  }
  return null
}

export function addCorsHeaders(response: NextResponse, origin: string | null) {
  const headers = corsHeaders(origin)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}