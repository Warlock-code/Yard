const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  const posts = await prisma.post.findMany({ select: { id: true, text: true } })
  const comments = await prisma.comment.findMany({ select: { id: true, text: true } })

  for (let index = 0; index < posts.length; index += 25) {
    await prisma.$transaction(
      posts.slice(index, index + 25).map((post) => prisma.post.update({
        where: { id: post.id },
        data: { text: post.text?.toLowerCase() ?? post.text },
      }))
    )
  }

  for (let index = 0; index < comments.length; index += 25) {
    await prisma.$transaction(
      comments.slice(index, index + 25).map((comment) => prisma.comment.update({
        where: { id: comment.id },
        data: { text: comment.text.toLowerCase() },
      }))
    )
  }

  console.log(`lowercased ${posts.length} posts and ${comments.length} comments`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
