import { NextRequest, NextResponse } from "next/server"
import { signAdminToken } from "@/lib/adminAuth"
import { rateLimitWithInfo } from "@/lib/rateLimit"
import { auditLog } from "@/lib/auditLog"

const ADMIN_IP_ALLOWLIST = process.env.ADMIN_ALLOWED_IPS?.split(",").map(ip => ip.trim()) || []

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  if (ADMIN_IP_ALLOWLIST.length > 0 && !ADMIN_IP_ALLOWLIST.includes(ip)) {
    await auditLog("admin.login", null, null, { success: false, reason: "IP not allowed", ipAddress: ip })
    return NextResponse.json({ error: "Access denied." }, { status: 403 })
  }

  const rl = rateLimitWithInfo(`admin:login:${ip}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    await auditLog("admin.login", null, null, { success: false, reason: "Rate limited", ipAddress: ip })
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  const { username, password } = await req.json().catch(() => ({}))
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required." }, { status: 400 })
  }

  const success = username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD

  await auditLog("admin.login", success ? "admin" : null, null, {
    success,
    username: success ? username : "redacted",
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || null,
  })

  if (!success) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  const token = signAdminToken()
  const res = NextResponse.json({ success: true })
  res.cookies.set("yard_admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
  return res
}