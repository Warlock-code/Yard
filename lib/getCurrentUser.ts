import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/auth"

export async function getCurrentUser(req: NextRequest | string) {
  const token = typeof req === "string" ? req : req.cookies.get("yard_token")?.value
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user || user.status !== "ACTIVE") return null
  return user
}