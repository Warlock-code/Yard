if (decision === "dismissed" && report.postId) {
  await prisma.post.update({ where: { id: report.postId }, data: { archived: false } })
}
if (decision === "actioned" && report.postId) {
  await prisma.post.delete({ where: { id: report.postId } })
}