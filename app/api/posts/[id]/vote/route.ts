const MILESTONES = [10, 50, 100, 500, 1000] // yeah counts
const MILESTONE_BONUS_PESEWAS: Record<number, number> = {
  10: 50,     // GHS 0.50
  50: 200,    // GHS 2.00
  100: 500,   // GHS 5.00
  500: 2000,  // GHS 20.00
  1000: 5000, // GHS 50.00
}

// after incrementing yeahs and confirming owner.tier === "PRIME":
if (owner && owner.tier === "PRIME" && MILESTONES.includes(post.yeahs)) {
  await prisma.earning.create({
    data: {
      userId: owner.id,
      source: "milestone_bonus",
      sourceId: post.id,
      amount: MILESTONE_BONUS_PESEWAS[post.yeahs],
    },
  })
}