import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type PaystackCharge = {
  status?: unknown
  reference?: unknown
  amount?: unknown
  currency?: unknown
  customer?: { email?: unknown } | null
}

type Metadata = Record<string, Prisma.JsonValue>

function metadata(value: Prisma.JsonValue | null): Metadata | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Metadata
    : null
}

function requireString(value: Prisma.JsonValue | undefined, field: string) {
  if (typeof value !== "string" || !value) throw new Error(`Invalid ${field}.`)
  return value
}

/**
 * Ensures the Paystack charge belongs to the pending Yard transaction. This is
 * deliberately shared by the signed webhook and the customer callback: the
 * callback is only a convenience, never a source of truth.
 */
export async function validatePaystackCharge(reference: string, charge: PaystackCharge) {
  const tx = await prisma.transaction.findUnique({
    where: { reference },
    include: { user: { select: { email: true } } },
  })
  if (!tx) throw new Error("Unknown transaction.")

  // For subscription plans (plus/prime) Paystack amount is authoritative — allow stored amount to be corrected
  const isSubscription = tx.kind === "plus" || tx.kind === "prime"
  const amountMatches = isSubscription
    ? Number.isSafeInteger(charge.amount) && (charge.amount as number) > 0
    : charge.amount === tx.amount

  if (
    charge.status !== "success" ||
    charge.reference !== reference ||
    !Number.isSafeInteger(charge.amount) ||
    !amountMatches ||
    charge.currency !== "GHS" ||
    typeof charge.customer?.email !== "string" ||
    charge.customer.email.trim().toLowerCase() !== tx.user.email.trim().toLowerCase()
  ) {
    throw new Error("Payment details do not match this transaction.")
  }

  // Auto-correct stored amount for subscriptions if Paystack amount differs (legacy 0 or price change)
  if (isSubscription && (charge.amount as number) !== tx.amount) {
    await prisma.transaction.update({ where: { reference }, data: { amount: charge.amount as number } })
    tx.amount = charge.amount as number
  }

  return tx
}

/**
 * Deliver a paid item exactly once. The guarded status update and the item
 * update live in the same database transaction, so concurrent webhooks or
 * callbacks cannot credit an item twice.
 */
export async function fulfillPaidTransaction(reference: string) {
  return prisma.$transaction(async (db) => {
    const transaction = await db.transaction.findUnique({ where: { reference } })
    if (!transaction) throw new Error("Unknown transaction.")
    if (transaction.status === "success") return { alreadyFulfilled: true }
    if (transaction.status !== "pending") throw new Error("Transaction cannot be fulfilled.")

    // Claim the pending transaction first. `updateMany` makes this safe even
    // when Paystack retries a webhook while a callback is in flight.
    const claim = await db.transaction.updateMany({
      where: { reference, status: "pending" },
      data: { status: "success" },
    })
    if (claim.count !== 1) return { alreadyFulfilled: true }

    const meta = metadata(transaction.metadata)
    const userId = transaction.userId

    switch (transaction.kind) {
      case "boost": {
        const postId = requireString(meta?.postId, "boost metadata")
        const post = await db.post.findFirst({ where: { id: postId, userId }, select: { id: true } })
        if (!post) throw new Error("Boost post is unavailable.")
        await db.post.update({
          where: { id: post.id },
          data: { boosted: true, boostedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        })
        break
      }
      case "custom_name": {
        const newName = requireString(meta?.newName, "custom-name metadata")
        await db.user.update({ where: { id: userId }, data: { ghostId: newName } })
        break
      }
      case "freeze":
        await db.user.update({ where: { id: userId }, data: { streakFreezeUntil: new Date(Date.now() + 48 * 60 * 60 * 1000) } })
        break
      case "storage": {
        const mb = meta?.mb
        if (typeof mb !== "number" || !Number.isSafeInteger(mb) || mb <= 0) throw new Error("Invalid storage metadata.")
        await db.user.update({ where: { id: userId }, data: { storageLimit: { increment: mb } } })
        break
      }
      case "restore": {
        const user = await db.user.findUnique({ where: { id: userId }, select: { lastStreakCount: true } })
        if (user?.lastStreakCount) {
          await db.user.update({ where: { id: userId }, data: { streakCount: user.lastStreakCount, lastStreakCount: null, streakBrokenAt: null } })
        }
        break
      }
      case "cosmetic": {
        const cosmeticId = requireString(meta?.cosmeticId, "cosmetic metadata")
        const user = await db.user.findUnique({ where: { id: userId }, select: { ownedCosmetics: true } })
        if (!user) throw new Error("User not found.")
        if (!user.ownedCosmetics.includes(cosmeticId)) {
          await db.user.update({ where: { id: userId }, data: { ownedCosmetics: { push: cosmeticId } } })
        }
        break
      }
      case "boost_credit":
        await db.user.update({ where: { id: userId }, data: { freeBoosts: { increment: 1 } } })
        break
      case "plus":
      case "prime": {
        const tier = (transaction.kind.toUpperCase() as "PLUS" | "PRIME") as any
        // Extend from max(now, current expiry) so early renewal doesn't lose days
        const u = await db.user.findUnique({ where: { id: userId }, select: { tierExpiresAt: true } })
        const base = Math.max(Date.now(), u?.tierExpiresAt?.getTime() ?? 0)
        const next = new Date(base + 31 * 24 * 60 * 60 * 1000)
        await db.user.update({ where: { id: userId }, data: { tier, tierExpiresAt: next } })
        break
      }
      default:
        throw new Error("Unsupported transaction kind.")
    }

    return { alreadyFulfilled: false }
  })
}
