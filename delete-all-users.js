import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("Deleting all users and related data...")

  await prisma.comment.deleteMany({})
  console.log("Deleted comments")

  await prisma.vote.deleteMany({})
  console.log("Deleted votes")

  await prisma.postVote.deleteMany({})
  console.log("Deleted post votes")

  await prisma.earning.deleteMany({})
  console.log("Deleted earnings")

  await prisma.payout.deleteMany({})
  console.log("Deleted payouts")

  await prisma.transaction.deleteMany({})
  console.log("Deleted transactions")

  await prisma.report.deleteMany({})
  console.log("Deleted reports")

  await prisma.notification.deleteMany({})
  console.log("Deleted notifications")

  await prisma.deviceToken.deleteMany({})
  console.log("Deleted device tokens")

  await prisma.mediaUpload.deleteMany({})
  console.log("Deleted media uploads")

  await prisma.battleEntry.deleteMany({})
  console.log("Deleted battle entries")

  await prisma.battlePrompt.deleteMany({})
  console.log("Deleted battle prompts")

  await prisma.follow.deleteMany({})
  console.log("Deleted follows")

  await prisma.aiDraft.deleteMany({})
  console.log("Deleted AI drafts")

  await prisma.post.deleteMany({})
  console.log("Deleted posts")

  const deletedUsers = await prisma.user.deleteMany({})
  console.log(`Deleted ${deletedUsers.count} users`)

  await prisma.rateLimit.deleteMany({})
  console.log("Deleted rate limits")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())