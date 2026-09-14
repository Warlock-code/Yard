import { NextRequest } from "next/server"
import { verifyAdminToken } from "@/lib/adminAuth"

export function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("yard_admin_token")?.value
  if (!token) return false
  return verifyAdminToken(token)
}