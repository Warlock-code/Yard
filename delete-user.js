import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const email = "2526404295@live.gctu.edu.gh"   // change this

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.log("User not found")
    return
  }

  const userId = user.id
  console.log("Deleting user:", email, userId)

  // Delete related records first
  await prisma.comment.deleteMany({ where: { userId } })
  await prisma.vote.deleteMany({ where: { userId } })
  await prisma.earning.deleteMany({ where: { userId } })
  await prisma.post.deleteMany({ where: { userId } })
  await prisma.payout.deleteMany({ where: { userId } }).catch(() => {})
  await prisma.transaction.deleteMany({ where: { userId } }).catch(() => {})
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }).catch(() => {})

  // Now delete the user
  await prisma.user.delete({ where: { id: userId } })
  console.log("Successfully deleted:", email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())