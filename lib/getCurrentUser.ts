import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/auth"

export async function getCurrentUser(req: NextRequest) {
  const token = req.cookies.get("yard_token")?.value
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  return user
}