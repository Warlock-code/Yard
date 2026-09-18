import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export type AuditAction =
  | "admin.login"
  | "admin.user.suspend"
  | "admin.user.ban"
  | "admin.user.delete"
  | "admin.post.delete"
  | "admin.report.actioned"
  | "admin.report.dismissed"
  | "admin.payout.approve"
  | "admin.payout.reject"
  | "admin.battle.create"
  | "admin.ai_draft.publish"
  | "admin.ai_draft.reject"
  | "payment.initiated"
  | "payment.completed"
  | "payment.failed"
  | "payout.requested"
  | "payout.approved"
  | "payout.paid"
  | "payout.rejected"
  | "user.signup"
  | "user.login"
  | "user.delete_account"
  | "user.verify_email"
  | "user.referral"
  | "payout.approved"
  | "payout.paid"
  | "payout.rejected"
  | "user.signup"
  | "user.login"
  | "user.delete_account"
  | "user.verify_email"

export async function auditLog(
  action: AuditAction,
  actorId: string | null,
  targetId: string | null,
  metadata: Record<string, unknown> = {}
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actorId,
        targetId,
        metadata: metadata as Prisma.InputJsonValue,
        ipAddress: (metadata.ipAddress as string) || null,
        userAgent: (metadata.userAgent as string) || null,
      },
    })
  } catch (error) {
    console.error("Audit log failed:", error)
  }
}

export async function getAuditLogs(filters: {
  action?: AuditAction
  actorId?: string
  targetId?: string
  from?: Date
  to?: Date
  limit?: number
  offset?: number
} = {}) {
  const where: Record<string, unknown> = {}
  if (filters.action) where.action = filters.action
  if (filters.actorId) where.actorId = filters.actorId
  if (filters.targetId) where.targetId = filters.targetId
  if (filters.from || filters.to) {
    where.createdAt = {}
    if (filters.from) (where.createdAt as Record<string, Date>).gte = filters.from
    if (filters.to) (where.createdAt as Record<string, Date>).lte = filters.to
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters.limit || 50,
    skip: filters.offset || 0,
  })
}