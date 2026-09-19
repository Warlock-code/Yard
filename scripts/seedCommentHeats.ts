import { prisma } from "@/lib/prisma"

async function main() {
  const rows = await prisma.$executeRawUnsafe(
    'UPDATE "Comment" SET yeahs = (POWER(random(), 3) * 120)::int WHERE yeahs = 0'
  )
  console.log("seeded heats, rows=", rows)
  const top = await prisma.comment.findMany({
    orderBy: { yeahs: "desc" },
    take: 3,
    select: { yeahs: true },
  })
  console.log("top heats=", JSON.stringify(top))
  const dist = await prisma.$queryRawUnsafe<{ bucket: number; n: bigint }[]>(
    `SELECT (yeahs/20) AS bucket, COUNT(*) AS n FROM "Comment" GROUP BY 1 ORDER BY 1`
  )
  console.log("dist=", dist.map((d) => `${d.bucket * 20}-${d.bucket * 20 + 19}:${d.n}`).join(" "))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
