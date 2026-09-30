import { NextResponse } from "next/server"

export async function GET() {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  return NextResponse.json({ socketUrl })
}

export const dynamic = "force-dynamic"