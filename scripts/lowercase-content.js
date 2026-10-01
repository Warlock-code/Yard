const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe('UPDATE "Post" SET "text" = LOWER("text") WHERE "text" IS NOT NULL')
  await prisma.$executeRawUnsafe('UPDATE "Comment" SET "text" = LOWER("text")')

  const [posts, comments] = await Promise.all([
    prisma.post.count(),
    prisma.comment.count(),
  ])

  console.log(`lowercased ${posts.length} posts and ${comments.length} comments`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
