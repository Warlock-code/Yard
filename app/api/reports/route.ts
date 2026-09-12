import { moderateWithAI } from "@/lib/moderateWithAI"

// after archiving the post
const post = await prisma.post.findUnique({ where: { id: postId } })
const verdict = await moderateWithAI(post?.text || "", reason)

await prisma.report.update({ where: { id: report.id }, data: { aiVerdict: verdict } })