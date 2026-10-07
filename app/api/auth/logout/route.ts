import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true })
  const isProd = process.env.NODE_ENV === "production"
  response.cookies.set("yard_token", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
  // Preserve yard_seen_welcome so logout doesn't reset onboarding.
  // (Delete-account clears it separately for a true fresh start.)
  return response
}