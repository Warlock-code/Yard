import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set("yard_token", "", { maxAge: 0, path: "/" })
  response.cookies.set("yard_seen_welcome", "", { maxAge: 0, path: "/" })
  return response
}