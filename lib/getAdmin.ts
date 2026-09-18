import { NextRequest } from "next/server"
import { verifyAdminToken } from "@/lib/adminAuth"

export function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("yard_admin_token")?.value
  if (!token) return false
  return verifyAdminToken(token)
}

export function getAdminUser(req: NextRequest): { authenticated: boolean } | null {
  const token = req.cookies.get("yard_admin_token")?.value
  if (!token || !verifyAdminToken(token)) return null
  return { authenticated: true }
}